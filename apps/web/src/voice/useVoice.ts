import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { USE_MOCK, wsBase } from "../lib/config";
import { lsGet, lsRemove, lsSet } from "../lib/device";
import type { LangMode } from "../api/types";
import type { EngineEvent, VoiceEngine, VoiceErrorCode } from "./engine";
import { GnaniEngine } from "./gnaniEngine";
import { WebSpeechEngine } from "./webSpeechEngine";

export type VoiceStatus =
  | "off"
  | "needs-gesture"
  | "listening"
  | "hearing"
  | "processing"
  | "speaking"
  | "muted"
  | "denied"
  | "unsupported"
  | "error";

export interface VoiceHandlers {
  onPartial: (text: string) => void;
  onSegment: (text: string) => void;
  onTurnEnd: () => void;
  onBargeIn: () => void;
  onError: (code: VoiceErrorCode, message: string) => void;
}

const PREF_KEY = "sutra.mic";

export interface VoiceApi {
  status: VoiceStatus;
  /** 0..1, smoothed mic level for the orb. */
  level: number;
  muted: boolean;
  /** True once the user has chosen voice (persisted). Drives auto-activation on the next visit. */
  preferred: boolean;
  enable: () => Promise<void>;
  disable: () => void;
  toggleMute: () => void;
  /** Call true while TTS plays (pauses the mic uplink, prevents echo), false when it ends. */
  setSpeaking: (speaking: boolean) => void;
}

type Base = "off" | "needs-gesture" | "listening" | "hearing" | "processing" | "denied" | "unsupported" | "error";

export function useVoice(langMode: LangMode, handlers: VoiceHandlers): VoiceApi {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const engineRef = useRef<VoiceEngine | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const mutedRef = useRef(false);
  const speakingRef = useRef(false);
  const levelRef = useRef(0);
  const langRef = useRef(langMode);
  langRef.current = langMode;

  const [base, setBase] = useState<Base>("off");
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeakingState] = useState(false);
  const [level, setLevel] = useState(0);
  const [preferred, setPreferred] = useState(() => lsGet(PREF_KEY) === "1");

  const applyUplink = useCallback(() => {
    engineRef.current?.setUplinkPaused(mutedRef.current || speakingRef.current);
  }, []);

  const onEvent = useCallback(
    (e: EngineEvent) => {
      switch (e.type) {
        case "level":
          levelRef.current = Math.min(1, e.rms * 12);
          break;
        case "speech_start":
          setBase((b) => (b === "listening" || b === "hearing" ? "hearing" : b));
          break;
        case "processing":
          setBase((b) => (b === "hearing" ? "processing" : b));
          break;
        case "partial":
          handlersRef.current.onPartial(e.text);
          break;
        case "segment":
          handlersRef.current.onSegment(e.text);
          break;
        case "turn_end":
          setBase((b) => (b === "hearing" || b === "processing" ? "listening" : b));
          handlersRef.current.onPartial("");
          handlersRef.current.onTurnEnd();
          break;
        case "barge_in":
          if (!mutedRef.current) handlersRef.current.onBargeIn();
          break;
        case "error":
          if (e.code === "denied") setBase("denied");
          else if (e.code === "unsupported") setBase("unsupported");
          else if (e.code === "socket" || e.code === "unknown") setBase((b) => (b === "hearing" || b === "processing" ? "listening" : b));
          handlersRef.current.onError(e.code, e.message);
          break;
      }
    },
    [],
  );

  const enable = useCallback(async () => {
    if (engineRef.current) return;
    const engine: VoiceEngine = USE_MOCK ? new WebSpeechEngine() : new GnaniEngine(wsBase());
    engine.setLang(langRef.current);
    engineRef.current = engine;
    unsubRef.current = engine.subscribe(onEvent);
    try {
      const { needsGesture } = await engine.start();
      lsSet(PREF_KEY, "1");
      setPreferred(true);
      applyUplink();
      if (needsGesture) {
        setBase("needs-gesture");
        // Browsers need one user gesture before audio can run. The first interaction anywhere wakes it.
        const wake = () => {
          void engine.resume().then(() => setBase("listening"));
        };
        window.addEventListener("pointerdown", wake, { once: true });
        window.addEventListener("keydown", wake, { once: true });
      } else {
        setBase("listening");
      }
    } catch {
      unsubRef.current?.();
      engineRef.current = null;
      // The engine already emitted a specific "denied" / "unsupported" error and set the state.
    }
  }, [applyUplink, onEvent]);

  const disable = useCallback(() => {
    unsubRef.current?.();
    engineRef.current?.stop();
    engineRef.current = null;
    lsRemove(PREF_KEY);
    setPreferred(false);
    setBase("off");
  }, []);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    applyUplink();
  }, [applyUplink]);

  const setSpeaking = useCallback(
    (s: boolean) => {
      speakingRef.current = s;
      setSpeakingState(s);
      applyUplink();
    },
    [applyUplink],
  );

  // Keep the engine's language hint in sync with the UI language.
  useEffect(() => {
    engineRef.current?.setLang(langMode);
  }, [langMode]);

  // Smooth level for the orb (~12 fps) instead of re-rendering on every 32 ms audio frame.
  useEffect(() => {
    const id = window.setInterval(() => setLevel((p) => p * 0.5 + levelRef.current * 0.5), 80);
    return () => window.clearInterval(id);
  }, []);

  // Release the mic on unmount.
  useEffect(
    () => () => {
      unsubRef.current?.();
      engineRef.current?.stop();
    },
    [],
  );

  const status: VoiceStatus = useMemo(() => {
    if (base === "off" || base === "denied" || base === "unsupported" || base === "error" || base === "needs-gesture") return base;
    if (muted) return "muted";
    if (speaking) return "speaking";
    return base;
  }, [base, muted, speaking]);

  return { status, level, muted, preferred, enable, disable, toggleMute, setSpeaking };
}
