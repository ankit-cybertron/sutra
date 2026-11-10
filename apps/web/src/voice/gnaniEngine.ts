import { Emitter, type EngineEvent, type StartResult, type VoiceEngine } from "./engine";

// Real voice path: mic -> AudioWorklet (16 kHz PCM16, 1024-byte frames) -> our backend WebSocket /ws/stt
// -> backend relays to Gnani Prisma realtime STT. The browser never talks to Gnani directly
// (browsers cannot set the required auth headers on a WebSocket, and the key must stay server-side).
//
// One WebSocket per spoken turn:
//   speech onset (VAD) -> open WS, flush ~320 ms pre-roll so the first syllable isn't lost, stream frames
//   ~1.2 s of silence  -> send {"type":"commit"}, wait for final transcripts, close, emit turn_end

const FRAME_MS = 32;
const PREROLL_FRAMES = 10; // 320 ms
const ONSET_FRAMES = 3; // ~96 ms of speech to start a turn
const SILENCE_MS = 1200;
const MAX_TURN_MS = 45_000;
const COMMIT_WAIT_MS = 3000;

export class GnaniEngine extends Emitter implements VoiceEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;

  private ws: WebSocket | null = null;
  private wsOpen = false;
  private queue: ArrayBuffer[] = [];
  private preroll: ArrayBuffer[] = [];

  private inTurn = false;
  private closing = false;
  private paused = false;
  private aboveCount = 0;
  private silenceMs = 0;
  private turnStart = 0;
  private noiseFloor = 0.01;
  private bargeCount = 0;
  private closeTimer: number | undefined;
  private lang = "auto";

  constructor(private wsBase: string) {
    super();
  }

  setLang(lang: string): void {
    this.lang = lang;
  }

  async start(): Promise<StartResult> {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === "undefined") {
      this.emit({ type: "error", code: "unsupported", message: "Audio capture is not supported here." });
      throw new Error("unsupported");
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      this.emit({ type: "error", code: "denied", message: "Microphone permission was denied." });
      throw e;
    }

    try {
      this.ctx = new AudioContext({ sampleRate: 16000, latencyHint: "interactive" });
    } catch {
      this.ctx = new AudioContext({ latencyHint: "interactive" }); // worklet downsamples from the native rate
    }
    await this.ctx.audioWorklet.addModule("/pcm-worklet.js");

    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "pcm-processor");
    this.node.port.onmessage = (ev: MessageEvent<{ frame: ArrayBuffer; rms: number }>) =>
      this.onFrame(ev.data.frame, ev.data.rms);
    // The worklet must be pulled by the graph; route it to a muted gain so nothing is audible (no echo).
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    src.connect(this.node);
    this.node.connect(mute);
    mute.connect(this.ctx.destination);

    return { needsGesture: this.ctx.state === "suspended" };
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
  }

  stop(): void {
    window.clearTimeout(this.closeTimer);
    this.ws?.close();
    this.ws = null;
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.stream = null;
    this.node = null;
    this.inTurn = false;
  }

  setUplinkPaused(paused: boolean): void {
    this.paused = paused;
    this.bargeCount = 0;
    if (paused) {
      this.preroll = [];
      this.aboveCount = 0;
      if (this.inTurn) this.commitTurn();
    }
  }

  // ---- audio frames -------------------------------------------------------------------------

  private onFrame(frame: ArrayBuffer, rms: number): void {
    this.emit({ type: "level", rms });

    const thr = Math.max(0.012, this.noiseFloor * 3);
    const loud = rms > thr;
    if (!this.inTurn && !loud) this.noiseFloor = this.noiseFloor * 0.97 + rms * 0.03;

    if (this.paused) {
      // Barge-in: only a clearly louder sound than background while TTS plays counts (avoids echo triggers).
      if (rms > Math.max(0.06, this.noiseFloor * 6)) {
        this.bargeCount += 1;
        if (this.bargeCount >= 8) {
          this.bargeCount = 0;
          this.emit({ type: "barge_in" });
        }
      } else {
        this.bargeCount = 0;
      }
      return;
    }

    if (!this.inTurn) {
      this.preroll.push(frame);
      if (this.preroll.length > PREROLL_FRAMES) this.preroll.shift();
      this.aboveCount = loud ? this.aboveCount + 1 : 0;
      if (this.aboveCount >= ONSET_FRAMES) this.openTurn();
      return;
    }

    this.sendFrame(frame);
    this.silenceMs = rms < thr * 0.7 ? this.silenceMs + FRAME_MS : 0;
    if (!this.closing && (this.silenceMs >= SILENCE_MS || performance.now() - this.turnStart > MAX_TURN_MS)) {
      this.commitTurn();
    }
  }

  // ---- turn lifecycle -----------------------------------------------------------------------

  private openTurn(): void {
    this.inTurn = true;
    this.closing = false;
    this.silenceMs = 0;
    this.turnStart = performance.now();
    this.queue = [];
    this.wsOpen = false;
    this.emit({ type: "speech_start" });

    const ws = new WebSocket(`${this.wsBase}/ws/stt?lang=${encodeURIComponent(this.lang)}`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      this.wsOpen = true;
      for (const f of this.queue) ws.send(f);
      this.queue = [];
      if (this.closing) this.sendCommit();
    };
    ws.onmessage = (ev) => this.onMessage(ev);
    ws.onerror = () => this.fail("socket", "Voice connection failed.");
    ws.onclose = () => this.finishTurn();

    for (const f of this.preroll) this.sendFrame(f);
    this.preroll = [];
  }

  private sendFrame(frame: ArrayBuffer): void {
    if (this.wsOpen && this.ws) this.ws.send(frame);
    else this.queue.push(frame);
  }

  private sendCommit(): void {
    this.ws?.send(JSON.stringify({ type: "commit" }));
  }

  private commitTurn(): void {
    if (!this.inTurn || this.closing) return;
    this.closing = true;
    this.emit({ type: "processing" });
    if (this.wsOpen) this.sendCommit();
    // Safety net: never wait forever for the server to close.
    this.closeTimer = window.setTimeout(() => this.ws?.close(), COMMIT_WAIT_MS);
  }

  private onMessage(ev: MessageEvent): void {
    if (typeof ev.data !== "string") return;
    let m: { type?: string; text?: string; segmentId?: number; lang?: string; code?: string; message?: string };
    try {
      m = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (m.type === "transcript" && m.text) {
      this.emit({ type: "segment", text: m.text, segmentId: m.segmentId, lang: m.lang });
    } else if (m.type === "error") {
      const code = m.code === "RATE_LIMITED" ? "rate_limited" : m.code === "BUSY" ? "busy" : "unknown";
      this.fail(code, m.message ?? "Voice error.");
    } else if (m.type === "done") {
      this.ws?.close();
    }
  }

  private finishTurn(): void {
    window.clearTimeout(this.closeTimer);
    const was = this.inTurn;
    this.inTurn = false;
    this.closing = false;
    this.ws = null;
    this.wsOpen = false;
    this.queue = [];
    this.aboveCount = 0;
    if (was) this.emit({ type: "turn_end" });
  }

  private fail(code: Extract<EngineEvent, { type: "error" }>["code"], message: string): void {
    this.emit({ type: "error", code, message });
    this.ws?.close();
  }
}
