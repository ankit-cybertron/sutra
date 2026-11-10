import { useCallback, useRef } from "react";
import { api } from "../api";
import type { Lang } from "../api/types";
import { USE_MOCK } from "../lib/config";

// Consistent natural female voice selection
function getNaturalFemaleVoice(lang: Lang): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const isHindi = lang === "hi";

  // Prioritized list of known natural female voices
  const preferredFemaleNames = isHindi
    ? [
        "Lekha",
        "Google हिन्दी",
        "Kalpana",
        "Neerja",
        "Swara",
        "Kavya",
        "Veena",
        "Heera",
      ]
    : [
        "Samantha",
        "Karen",
        "Victoria",
        "Moira",
        "Google UK English Female",
        "Google US English",
        "Zira",
        "Jenny",
        "Sonia",
        "Fiona",
        "Tessa",
      ];

  for (const name of preferredFemaleNames) {
    const match = voices.find((v) => v.name.toLowerCase().includes(name.toLowerCase()));
    if (match) return match;
  }

  // Fallback: search for any voice containing 'female' in target language or general
  const femaleLang = voices.find(
    (v) =>
      v.lang.toLowerCase().startsWith(isHindi ? "hi" : "en") &&
      v.name.toLowerCase().includes("female"),
  );
  if (femaleLang) return femaleLang;

  const anyLang = voices.find((v) => v.lang.toLowerCase().startsWith(isHindi ? "hi" : "en"));
  return anyLang || voices[0] || null;
}

export function useSpeaker() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    pendingRef.current?.();
    pendingRef.current = null;
  }, []);

  const speakWithSynthesis = useCallback((line: string, lang: Lang): Promise<boolean> => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      const u = new SpeechSynthesisUtterance(line);
      u.lang = lang === "hi" ? "hi-IN" : "en-IN";
      u.rate = 1.0;
      u.pitch = 1.05; // Slightly higher pitch for natural female clarity

      const voice = getNaturalFemaleVoice(lang);
      if (voice) {
        u.voice = voice;
      }

      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      pendingRef.current = () => resolve(false);
      window.speechSynthesis.speak(u);
    });
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
            // If the blob is audio/mpeg, it's real Gnani Timbre audio
            if (blob.type === "audio/mpeg" || blob.size > 20000) {
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
            }
          } catch {
            // Backend TTS network error: fall back to speech synthesis
          }
        }

        // Use natural female WebSpeech synthesis
        return await speakWithSynthesis(line, lang);
      } catch {
        return false;
      } finally {
        pendingRef.current = null;
      }
    },
    [stop, speakWithSynthesis],
  );

  return { speak, stop };
}
