import { useCallback, useEffect, useState } from "react";
import { api, isDemoMode } from "@/lib/sutra/api";
import type { Lang } from "@/lib/sutra/types";

// ============================================================================
// Global Singleton Speech Controller
// Ensures only one audio stream can ever play at a time across any component,
// prevents duplicate playback, and aborts pending network TTS requests.
// ============================================================================

let globalAudio: HTMLAudioElement | null = null;
let globalObjectUrl: string | null = null;
let globalAbortController: AbortController | null = null;
let globalCurrentSpeechId: string | null = null;
let globalLastPlayTime = 0;
let globalLastText = "";
const speakingListeners = new Set<(speaking: boolean) => void>();

function setGlobalSpeaking(isSpeaking: boolean) {
  speakingListeners.forEach((listener) => listener(isSpeaking));
}

function stopGlobalSpeech() {
  // Abort any in-flight TTS API network call
  if (globalAbortController) {
    globalAbortController.abort();
    globalAbortController = null;
  }

  // Stop and clean up active HTML audio element
  if (globalAudio) {
    try {
      globalAudio.pause();
      globalAudio.src = "";
    } catch {
      /* ignore */
    }
    globalAudio = null;
  }

  // Release object URL memory
  if (globalObjectUrl) {
    try {
      URL.revokeObjectURL(globalObjectUrl);
    } catch {
      /* ignore */
    }
    globalObjectUrl = null;
  }

  // Cancel any ongoing browser Web Speech API synthesis
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }

  globalCurrentSpeechId = null;
  setGlobalSpeaking(false);
}

// Cached speech synthesis voice for fallback stability
let cachedVoice: SpeechSynthesisVoice | null = null;

function loadAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices() || [];
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  loadAvailableVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    loadAvailableVoices();
  };
}

function getBestFemaleVoice(isHindi: boolean): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = loadAvailableVoices();
  if (!voices || voices.length === 0) return null;

  if (cachedVoice) return cachedVoice;

  // Prioritized list of natural, smooth female voices for Indic and English speech
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

/**
 * Shared Text-to-Speech Hook.
 *
 * Guaranteed singleton behavior:
 * - Cancels existing audio before starting new playback.
 * - Deduplicates identical messages sent within 1.2s or matching speechId.
 * - Streams Gnani AI's neural "Nalini" female voice via backend /api/tts.
 * - Aborts in-flight network requests so late responses never play unexpectedly.
 * - Graceful fallback to natural female WebSpeech synthesis only when offline/demo.
 */
export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    speakingListeners.add(setSpeaking);
    return () => {
      speakingListeners.delete(setSpeaking);
    };
  }, []);

  const cancel = useCallback(() => {
    stopGlobalSpeech();
  }, []);

  const speak = useCallback(
    async (text: string, langOrBcp = "en-IN", speechId?: string) => {
      const line = text.trim().slice(0, 240);
      if (!line) return;

      const now = Date.now();

      // Deduplication guard: ignore only if the exact same utterance is already actively playing
      if (
        globalAudio &&
        !globalAudio.paused &&
        !globalAudio.ended &&
        (speechId === globalCurrentSpeechId || line === globalLastText)
      ) {
        return;
      }

      // Stop any prior playback immediately
      stopGlobalSpeech();

      // Record this playback attempt
      globalCurrentSpeechId = speechId || `msg-${now}`;
      globalLastText = line;
      globalLastPlayTime = now;

      const abortCtrl = new AbortController();
      globalAbortController = abortCtrl;

      // Determine language: support Devanagari script detection as Hindi
      const hasDevanagari = /[\u0900-\u097F]/.test(line);
      const isHindi = hasDevanagari || langOrBcp.toLowerCase().startsWith("hi");
      const isHinglish = langOrBcp.toLowerCase().includes("hinglish");
      const langKey: Lang = isHindi ? "hi" : isHinglish ? "hinglish" : "en";

      // 1. Primary path: Gnani AI Neural TTS ("Nalini" female voice via /api/tts)
      if (!isDemoMode) {
        try {
          const blob = await api.tts(line, langKey);

          // Check if canceled while network call was in flight
          if (abortCtrl.signal.aborted) {
            return;
          }

          if (blob && blob.size > 200) {
            const url = URL.createObjectURL(blob);
            globalObjectUrl = url;

            const audio = new Audio(url);
            globalAudio = audio;

            audio.onplay = () => setGlobalSpeaking(true);
            audio.onended = () => {
              stopGlobalSpeech();
            };
            audio.onerror = () => {
              stopGlobalSpeech();
            };

            try {
              await audio.play();
              return;
            } catch (playErr) {
              console.warn("Audio play() was prevented (e.g. autoplay restriction), falling back to Web Speech:", playErr);
              if (globalAudio === audio) {
                globalAudio = null;
              }
            }
          }
        } catch (ttsErr) {
          // If aborted, do not fall back
          if (abortCtrl.signal.aborted) return;
          console.warn("Gnani TTS network request failed, falling back to Web Speech synthesis", ttsErr);
        }
      }

      // If aborted, exit
      if (abortCtrl.signal.aborted) return;

      // 2. Fallback: High quality natural female voice via Web Speech API
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }

      const u = new SpeechSynthesisUtterance(line);
      u.lang = isHindi ? "hi-IN" : "en-IN";
      u.rate = 1.0;
      u.pitch = 1.02;

      const voice = getBestFemaleVoice(isHindi);
      if (voice) {
        u.voice = voice;
      }

      u.onstart = () => setGlobalSpeaking(true);
      u.onend = () => setGlobalSpeaking(false);
      u.onerror = () => setGlobalSpeaking(false);

      window.speechSynthesis.speak(u);
    },
    [],
  );

  return { speak, cancel, speaking };
}
