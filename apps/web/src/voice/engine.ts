export type VoiceErrorCode = "denied" | "unsupported" | "socket" | "busy" | "rate_limited" | "unknown";

export type EngineEvent =
  | { type: "level"; rms: number }
  | { type: "speech_start" }
  | { type: "partial"; text: string }
  | { type: "segment"; text: string; segmentId?: number; lang?: string }
  | { type: "processing" }
  | { type: "turn_end" }
  | { type: "barge_in" }
  | { type: "error"; code: VoiceErrorCode; message: string };

export interface StartResult {
  /** True when the AudioContext is suspended and needs one user gesture to resume. */
  needsGesture: boolean;
}

export interface VoiceEngine {
  start(): Promise<StartResult>;
  resume(): Promise<void>;
  stop(): void;
  /** Stop sending audio (TTS playing, or user muted). Level/barge-in detection keeps running. */
  setUplinkPaused(paused: boolean): void;
  /** "auto" | "en" | "hi" | "hinglish" */
  setLang(lang: string): void;
  subscribe(fn: (e: EngineEvent) => void): () => void;
}

export class Emitter {
  private listeners = new Set<(e: EngineEvent) => void>();
  subscribe(fn: (e: EngineEvent) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  emit(e: EngineEvent): void {
    this.listeners.forEach((l) => l(e));
  }
}
