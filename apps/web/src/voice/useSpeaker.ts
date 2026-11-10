import { useCallback, useRef, useEffect } from "react";
import { api } from "../api";
import type { Lang } from "../api/types";
import { USE_MOCK } from "../lib/config";

// Cached speech synthesis voice for fallback stability
let cachedVoice: SpeechSynthesisVoice | null = null;

function loadAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const v = window.speechSynthesis.getVoices();
  return v || [];
}

// Ensure voices are loaded early
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  loadAvailableVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    loadAvailableVoices();
  };
}

function getConsistentFemaleVoice(lang: Lang): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = loadAvailableVoices();
  if (!voices || voices.length === 0) return null;

  // If a voice is already locked in, maintain continuity throughout the session
  if (cachedVoice) return cachedVoice;

  const isHindi = lang === "hi";

  // Prioritized list of known natural, smooth female voices
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
        "Samantha",
      ]
    : [
        "Samantha",
        "Victoria",
        "Karen",
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
    if (match) {
      cachedVoice = match;
      return match;
    }
  }

  // Fallback: search for any voice containing 'female' in target language or general
  const femaleLang = voices.find(
    (v) =>
      v.lang.toLowerCase().startsWith(isHindi ? "hi" : "en") &&
      v.name.toLowerCase().includes("female"),
  );
  if (femaleLang) {
    cachedVoice = femaleLang;
    return femaleLang;
  }

  const anyLang = voices.find((v) => v.lang.toLowerCase().startsWith(isHindi ? "hi" : "en"));
  cachedVoice = anyLang || voices[0] || null;
  return cachedVoice;
}

export function useSpeaker() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Pre-warm voices on hook mount
    loadAvailableVoices();
  }, []);

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
      u.pitch = 1.02; // Smooth natural female pitch

      const voice = getConsistentFemaleVoice(lang);
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
            // Real Gnani Timbre audio is MP3 or non-mock payload
            // (Mock WAV sine wave tone is exactly 16044 bytes with audio/wav)
            const isMockWav = blob.type === "audio/wav" && blob.size === 16044;

            if (!isMockWav && blob.size > 200) {
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
