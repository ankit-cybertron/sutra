import { useCallback, useEffect, useRef, useState } from "react";

// Browser speech capture: Web Speech API for transcript + an AnalyserNode for live mic level.
// Recognises spoken commands "done" and "skip" at the end of an utterance.

type Cmd = "done" | "skip";
interface Opts {
  lang: string;
  onTranscript: (finalText: string, interim: string) => void;
  onCommand?: (cmd: Cmd) => void;
  onStart?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = any;

export function useVoice({ lang, onTranscript, onCommand, onStart }: Opts) {
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<AnyRec>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const finalRef = useRef("");
  const cbs = useRef({ onTranscript, onCommand, onStart });
  cbs.current = { onTranscript, onCommand, onStart };

  useEffect(() => {
    const w = window as AnyRec;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    recRef.current = null;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
    setListening(false);
  }, []);

  const start = useCallback(
    async (seed = "") => {
      setError(null);
      const w = window as AnyRec;
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      cbs.current.onStart?.();
      // Mic level meter
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = ((buf[i] ?? 128) - 128) / 128;
            sum += v * v;
          }
          setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError("Microphone permission was denied. You can still type.");
        return;
      }
      setListening(true);
      if (!SR) {
        setError("Live transcription isn't supported in this browser — try Chrome. You can type instead.");
        return;
      }
      const rec = new SR();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      finalRef.current = seed ? seed.trimEnd() + " " : "";
      rec.onresult = (e: AnyRec) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const t: string = r[0].transcript;
          if (r.isFinal) {
            const cmd = t.trim().toLowerCase().match(/\b(done|skip)[.!]?$/);
            const clean = cmd ? t.replace(/\b(done|skip)[.!]?\s*$/i, "") : t;
            finalRef.current += clean.trim() ? clean.trim() + " " : "";
            cbs.current.onTranscript(finalRef.current.trim(), "");
            if (cmd) {
              cbs.current.onCommand?.(cmd[1] as Cmd);
              stop();
              return;
            }
          } else interim += t;
        }
        if (interim) cbs.current.onTranscript(finalRef.current.trim(), interim);
      };
      rec.onerror = (e: AnyRec) => {
        if (e.error !== "no-speech" && e.error !== "aborted") setError(`Voice error: ${e.error}`);
      };
      rec.onend = () => {
        if (recRef.current === rec) stop();
      };
      recRef.current = rec;
      rec.start();
    },
    [lang, stop],
  );

  useEffect(() => stop, [stop]);

  return { listening, level, supported, error, start, stop, toggle: (seed?: string) => (listening ? stop() : start(seed)) };
}
