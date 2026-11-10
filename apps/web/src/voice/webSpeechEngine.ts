import { Emitter, type StartResult, type VoiceEngine } from "./engine";

// Mock-mode voice: the browser's built-in SpeechRecognition (Chrome/Edge/Safari), so the whole
// voice UX can be demoed with no backend and no Gnani key. NOT used in production.

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const LANG_MAP: Record<string, string> = { hi: "hi-IN", en: "en-IN", hinglish: "hi-IN" };
const TURN_GAP_MS = 1200;

export class WebSpeechEngine extends Emitter implements VoiceEngine {
  private rec: Recognition | null = null;
  private running = false;
  private paused = false;
  private lang = "auto";
  private gapTimer: number | undefined;
  private pulse: number | undefined;

  setLang(lang: string): void {
    this.lang = lang;
    if (this.rec) this.rec.lang = LANG_MAP[lang] ?? navigator.language ?? "en-IN";
  }

  async start(): Promise<StartResult> {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      this.emit({ type: "error", code: "unsupported", message: "Speech recognition is not supported in this browser." });
      throw new Error("unsupported");
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = LANG_MAP[this.lang] ?? navigator.language ?? "en-IN";
    rec.onresult = (e) => {
      if (this.paused) return;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        const text = r[0].transcript;
        if (r.isFinal) this.emit({ type: "segment", text });
        else interim += text;
      }
      this.emit({ type: "speech_start" });
      if (interim) this.emit({ type: "partial", text: interim });
      window.clearTimeout(this.gapTimer);
      this.gapTimer = window.setTimeout(() => this.emit({ type: "turn_end" }), TURN_GAP_MS);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.running = false;
        this.emit({ type: "error", code: "denied", message: "Microphone permission was denied." });
      }
    };
    rec.onend = () => {
      if (this.running) {
        try {
          rec.start(); // continuous recognition ends on its own every so often; restart it
        } catch {
          /* already started */
        }
      }
    };
    this.rec = rec;
    this.running = true;
    rec.start();
    // Synthetic level so the orb animates (SpeechRecognition exposes no audio level).
    this.pulse = window.setInterval(() => {
      if (!this.paused) this.emit({ type: "level", rms: 0.02 });
    }, 200);
    return { needsGesture: false };
  }

  async resume(): Promise<void> {
    /* nothing to resume */
  }

  stop(): void {
    this.running = false;
    window.clearTimeout(this.gapTimer);
    window.clearInterval(this.pulse);
    this.rec?.abort();
    this.rec = null;
  }

  setUplinkPaused(paused: boolean): void {
    this.paused = paused;
  }
}
