import { useCallback, useRef } from "react";
import { api } from "../api";
import type { Lang } from "../api/types";
import { USE_MOCK } from "../lib/config";

// Plays the AI's spoken lines.
//   real mode: POST /api/tts -> Gnani Timbre audio (cached server-side) -> <audio>
//   mock mode: the browser's speechSynthesis
// Resolves true if audio played to the end, false if it was blocked, failed or interrupted.
// Browsers block audio until the user has interacted once, which is why the mic gate is a click.

export function useSpeaker() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    pendingRef.current?.();
    pendingRef.current = null;
  }, []);

  const speak = useCallback(
    async (text: string, lang: Lang): Promise<boolean> => {
      stop();
      const line = text.trim().slice(0, 240);
      if (!line) return false;
      try {
        if (!USE_MOCK) {
          try {
            const blob = await api.tts(line, lang);
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            await new Promise<void>((resolve, reject) => {
              pendingRef.current = resolve;
              audio.onended = () => resolve();
              audio.onerror = () => reject(new Error("audio"));
              audio.play().catch(reject);
            });
            URL.revokeObjectURL(url);
            return true;
          } catch {
            // Backend TTS network error: fall back to browser speech synthesis
          }
        }
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          return await new Promise<boolean>((resolve) => {
            const u = new SpeechSynthesisUtterance(line);
            u.lang = lang === "en" ? "en-IN" : "hi-IN";
            u.onend = () => resolve(true);
            u.onerror = () => resolve(false);
            pendingRef.current = () => resolve(false);
            window.speechSynthesis.speak(u);
          });
        }
        return false;
      } catch {
        return false;
      } finally {
        pendingRef.current = null;
      }
    },
    [stop],
  );

  return { speak, stop };
}
