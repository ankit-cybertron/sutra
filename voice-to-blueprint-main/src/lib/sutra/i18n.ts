import type { Lang } from "./types";

export const LANGS: { id: Lang; label: string; short: string; bcp47: string }[] = [
  { id: "en", label: "English", short: "EN", bcp47: "en-IN" },
  { id: "hi", label: "हिन्दी", short: "हि", bcp47: "hi-IN" },
  { id: "hinglish", label: "Hinglish", short: "HG", bcp47: "en-IN" },
];

type Strings = {
  heroTitleA: string;
  heroTitleB: string;
  heroSub: string;
  placeholder: string;
  refine: string;
  compile: string;
  tapToSpeak: string;
  listening: string;
  newIdea: string;
};

export const STRINGS: Record<Lang, Strings> = {
  en: {
    heroTitleA: "Speak your idea.",
    heroTitleB: "Ship the spec.",
    heroSub: "Ramble in English, Hindi or Hinglish. Sutra turns it into a production-ready PRD, build order and architecture — in seconds.",
    placeholder: "Describe what you want to build… or tap the orb and just talk.",
    refine: "Refine & clarify",
    compile: "Compile directly",
    tapToSpeak: "Tap to speak",
    listening: "Listening — say “done” to submit",
    newIdea: "New idea",
  },
  hi: {
    heroTitleA: "अपना आइडिया बोलिए।",
    heroTitleB: "स्पेक तैयार।",
    heroSub: "हिंदी, अंग्रेज़ी या हिंग्लिश में बोलिए। सूत्र उसे सेकंडों में PRD, बिल्ड ऑर्डर और आर्किटेक्चर में बदल देता है।",
    placeholder: "आप क्या बनाना चाहते हैं… या ऑर्ब दबाकर बस बोलिए।",
    refine: "स्पष्ट करें",
    compile: "सीधे बनाएं",
    tapToSpeak: "बोलने के लिए दबाएं",
    listening: "सुन रहे हैं — “done” बोलें",
    newIdea: "नया आइडिया",
  },
  hinglish: {
    heroTitleA: "Apna idea bolo.",
    heroTitleB: "Spec ready.",
    heroSub: "English, Hindi ya Hinglish mein bolo. Sutra use seconds mein PRD, build order aur architecture bana deta hai.",
    placeholder: "Kya banana hai batao… ya orb dabao aur bas bolo.",
    refine: "Refine & clarify",
    compile: "Seedha compile",
    tapToSpeak: "Bolne ke liye tap karo",
    listening: "Sun rahe hain — “done” bolo",
    newIdea: "Naya idea",
  },
};

export const SAMPLE_IDEAS = [
  "Doctor clinic slot booking on WhatsApp",
  "Freelance invoice tracker with payment reminders",
  "Tiffin service daily orders and delivery routes",
  "Society maintenance fee collection app",
];
