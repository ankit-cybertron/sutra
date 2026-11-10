import { ApiError } from "./errors";
import type {
  Api,
  AnswerInput,
  ChatInput,
  ChatResult,
  CreateSessionInput,
  CreateSessionResult,
  Lang,
  Plan,
  PlanDoc,
  Question,
} from "./types";
import { hasDevanagari } from "../lib/phrases";
import { lsGet, lsSet } from "../lib/device";

// Offline stand-in for the backend so the UI can be developed and demoed with no keys.
// It also simulates the guardrail and rate-limit responses so those UI states can be exercised:
//   ?mock=ratelimit  -> the 4th call returns 429 RATE_LIMITED (retryAfter 15s)
//   ?mock=blocked    -> every idea is rejected as INPUT_BLOCKED
//   ?mock=slow       -> adds 2.5s latency
//   ?mock=down       -> PROVIDER_UNAVAILABLE
// Typing an obvious injection ("ignore previous instructions ...") is also rejected, like the real guardrails.

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const flag = () => new URLSearchParams(window.location.search).get("mock");

let calls = 0;
async function gate(baseMs = 700): Promise<void> {
  const f = flag();
  calls += 1;
  await delay(f === "slow" ? baseMs + 2500 : baseMs);
  if (f === "down") throw new ApiError(503, "PROVIDER_UNAVAILABLE", "The AI service is unavailable.");
  if (f === "ratelimit" && calls > 3) throw new ApiError(429, "RATE_LIMITED", "Too many requests.", 15);
}

const INJECTION =
  /(ignore|disregard|forget)\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)|system\s+prompt|reveal\s+(your|the)\s+(prompt|instructions)|you\s+are\s+now\s+(dan|jailbroken)|developer\s+mode/i;
const MALICIOUS = /\b(ransomware|keylogger|phishing\s+(kit|page|site)|credential\s+stealer|ddos\s+tool)\b/i;

function guard(text: string): void {
  if (flag() === "blocked" || INJECTION.test(text) || MALICIOUS.test(text)) {
    throw new ApiError(422, "INPUT_BLOCKED", "Input was blocked by safety checks.");
  }
}

function detectLang(text: string): Lang {
  if (hasDevanagari(text)) return "hi";
  if (/\b(hai|hain|ke liye|mera|mere|meri|karna|chahiye|wala|wali|nahi|bhi|banana|kaise|kuch)\b/i.test(text)) return "hinglish";
  return "en";
}

function questionsFor(lang: Lang): Question[] {
  if (lang === "hi")
    return [
      {
        id: "q1",
        displayText: "इसे सबसे पहले कौन इस्तेमाल करेगा, और किस पर: फ़ोन, वेबसाइट या WhatsApp?",
        spokenText: "इसे सबसे पहले कौन इस्तेमाल करेगा, और किस पर: फ़ोन, वेबसाइट या WhatsApp?",
        options: ["फ़ोन ऐप", "वेबसाइट", "WhatsApp"],
      },
      {
        id: "q2",
        displayText: "पहले दिन यूज़र को कौन-सा एक काम ज़रूर कर पाना चाहिए?",
        spokenText: "पहले दिन यूज़र को कौन-सा एक काम ज़रूर कर पाना चाहिए?",
        options: [],
      },
    ];
  if (lang === "hinglish")
    return [
      {
        id: "q1",
        displayText: "Ise sabse pehle kaun use karega, aur kis par: phone, website ya WhatsApp?",
        spokenText: "इसे सबसे पहले कौन use करेगा, और किस पर: phone, website या WhatsApp?",
        options: ["Phone app", "Website", "WhatsApp"],
      },
      {
        id: "q2",
        displayText: "Pehle din user ko kaunsa ek kaam zaroor kar paana chahiye?",
        spokenText: "पहले दिन user को कौनसा एक काम ज़रूर कर पाना चाहिए?",
        options: [],
      },
    ];
  return [
    {
      id: "q1",
      displayText: "Who will use this first, and on what: phone, website, or WhatsApp?",
      spokenText: "Who will use this first, and on what: phone, website, or WhatsApp?",
      options: ["Phone app", "Website", "WhatsApp"],
    },
    {
      id: "q2",
      displayText: "What is the one thing a user must be able to do on day one?",
      spokenText: "What is the one thing a user must be able to do on day one?",
      options: [],
    },
  ];
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function buildPlan(idea: string, answers: AnswerInput[], lang: Lang): Plan {
  const platform = answers[0]?.text?.trim() || "a simple web app that works on a phone";
  const core = answers[1]?.text?.trim() || "complete the main task in under a minute";
  const short = idea.replace(/\s+/g, " ").trim();
  const words = short.split(" ").slice(0, 5).join(" ");
  const tiffin = /tiffin|mess|dabba/i.test(idea);
  const title = tiffin ? "Tiffin Orders" : titleCase(words.replace(/[.,!?]+$/, ""));

  return {
    title,
    oneLiner: tiffin
      ? "Daily tiffin orders and delivery tracking for a neighbourhood kitchen."
      : `A focused first version of: ${short.slice(0, 90)}${short.length > 90 ? "…" : ""}`,
    targetUser: tiffin
      ? "The owner of a small tiffin kitchen who today takes orders on WhatsApp and Excel."
      : `The first person who has this problem, using ${platform}.`,
    problem: tiffin
      ? "Orders arrive in scattered WhatsApp messages, so cooking counts and delivery routes are guessed every morning."
      : `${titleCase(short.slice(0, 160))}. Today this is handled by hand, so it is slow and easy to get wrong.`,
    mustHave: [
      {
        name: tiffin ? "One-tap daily order" : "Core action in one tap",
        why: `The day-one job is to ${core}.`,
        acceptance: [
          "A new user can finish the core action without reading instructions",
          "The result is saved and visible straight after",
          "Works on a 360px-wide phone screen",
        ],
      },
      {
        name: tiffin ? "Today's cooking count" : "Simple status list",
        why: "The owner needs one screen that shows what is pending and what is done.",
        acceptance: ["List updates within 2 seconds of a new entry", "Entries can be marked done or cancelled"],
      },
      {
        name: tiffin ? "Delivery run sheet" : "Reminder or notification",
        why: "Closes the loop so nothing is forgotten.",
        acceptance: ["A reminder is sent at a user-chosen time", "Never more than one reminder per item per day"],
      },
      {
        name: "Owner-only edit view",
        why: "One trusted person must be able to fix mistakes quickly.",
        acceptance: ["Owner can edit or delete any entry", "Changes show a visible 'edited' marker"],
      },
    ],
    later: ["Online payments", "Hindi and English UI toggle", "Weekly summary report"],
    outOfScope: ["Native iOS and Android apps", "Multi-branch support", "Marketplace of other kitchens"],
    buildOrder: [
      { step: 1, title: "Data model and seed data", detail: "Entries, status, owner. Seed 10 realistic rows." },
      { step: 2, title: "Core action screen", detail: "Build the one-tap flow first; ignore styling." },
      { step: 3, title: "Status list", detail: "Read-only list, then done and cancel actions." },
      { step: 4, title: "Reminder", detail: "Scheduled job plus a simple on/off setting." },
      { step: 5, title: "Polish and test", detail: "Empty, loading and error states; test on a real phone." },
    ],
    techNotes: `Target: ${platform}. Keep storage simple (JSON or SQLite) until real usage proves otherwise.`,
    risks: ["Scope creep from payments and delivery tracking", "Users may not trust a new app over WhatsApp"],
    assumptions: ["Fewer than 100 entries per day", "Owner has a smartphone with mobile data"],
    openQuestions: ["Who pays for SMS or WhatsApp message costs?"],
    suggestions: [
      { id: "s1", text: "Send reminders on WhatsApp", impact: "high" },
      { id: "s2", text: "Add a Hindi and English language toggle", impact: "medium" },
      { id: "s3", text: "Add a weekly summary for the owner", impact: "low" },
    ],
    firstPrompt:
      `Build the first version of "${title}": ${short.slice(0, 200)}.\n\n` +
      `Target platform: ${platform}. Day-one job: ${core}.\n\n` +
      "Build in this order: data model with seed data, core action screen, status list, reminder.\n" +
      "Keep it to a single codebase, no auth, JSON storage.\n\n" +
      "Do not build: payments, multi-branch support, native apps, or a marketplace.",
    language: lang,
  };
}

const STORE_KEY = "sutra.mock.plans";
const memory = new Map<string, PlanDoc>();
const sessions = new Map<string, { idea: string; lang: Lang }>();

function persist(doc: PlanDoc): void {
  memory.set(doc.id, doc);
  try {
    const all = JSON.parse(lsGet(STORE_KEY) ?? "{}") as Record<string, PlanDoc>;
    all[doc.id] = doc;
    lsSet(STORE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
function load(id: string): PlanDoc | undefined {
  const m = memory.get(id);
  if (m) return m;
  try {
    return (JSON.parse(lsGet(STORE_KEY) ?? "{}") as Record<string, PlanDoc>)[id];
  } catch {
    return undefined;
  }
}

const rid = () => Math.random().toString(36).slice(2, 10);

export const mockApi: Api = {
  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    await gate(600);
    guard(input.idea);
    const detected = input.lang === "auto" ? detectLang(input.idea) : input.lang;
    const sessionId = "s_" + rid();
    sessions.set(sessionId, { idea: input.idea, lang: detected });
    return { sessionId, detectedLang: detected, questions: questionsFor(detected) };
  },

  async generatePlan(sessionId: string, answers: AnswerInput[]): Promise<PlanDoc> {
    await gate(1800);
    const s = sessions.get(sessionId);
    if (!s) throw new ApiError(404, "NOT_FOUND", "Session not found.");
    answers.forEach((a) => guard(a.text));
    const doc: PlanDoc = { id: "p_" + rid(), version: 1, plan: buildPlan(s.idea, answers, "en"), changeSummary: [] };
    persist(doc);
    return doc;
  },

  async chat(planId: string, input: ChatInput): Promise<ChatResult> {
    await gate(900);
    guard(input.message);
    const doc = load(planId);
    if (!doc) throw new ApiError(404, "NOT_FOUND", "Plan not found.");
    const msg = input.message.trim();
    const lang = input.lang === "auto" ? detectLang(msg) : input.lang;

    const isQuestion = /\?\s*$/.test(msg) || /^(what|why|how|kya|kaise|kyun|क्या|कैसे|क्यों)\b/i.test(msg);
    if (isQuestion) {
      const reply =
        lang === "en"
          ? "Good question. In this plan the must-haves are kept to the smallest set that proves the idea. Tell me something to add or change and I will update the plan."
          : "अच्छा सवाल है। इस प्लान में must-have सिर्फ़ उतने रखे हैं जितने से आइडिया साबित हो जाए। कुछ जोड़ना या बदलना हो तो बताइए, मैं प्लान अपडेट कर दूँगा।";
      return { reply, spokenReply: reply, changeSummary: [] };
    }

    const item = msg.replace(/^(please\s+)?(add|include|also add|bhi add karo|add karo)\s+/i, "").slice(0, 120);
    const plan: Plan = { ...doc.plan, later: [...doc.plan.later, item] };
    const next: PlanDoc = {
      id: doc.id,
      version: doc.version + 1,
      plan,
      changeSummary: [`Added "${item}" under Later (kept out of v1 to protect scope).`],
    };
    persist(next);
    const reply =
      lang === "en"
        ? `Done. I added "${item}" under Later so version one stays small. Say "move it to must-have" if it cannot wait.`
        : `हो गया। मैंने "${item}" को Later में जोड़ दिया ताकि पहला वर्शन छोटा रहे। अगर यह रुक नहीं सकता तो बोलिए "must-have में डालो"।`;
    return { reply, spokenReply: reply, plan: next, changeSummary: next.changeSummary };
  },

  async getPlan(planId: string): Promise<PlanDoc> {
    await delay(200);
    const doc = load(planId);
    if (!doc) throw new ApiError(404, "NOT_FOUND", "Plan not found.");
    return doc;
  },

  async tts(): Promise<Blob> {
    // The mock voice path uses the browser's speechSynthesis instead (see useSpeaker).
    throw new ApiError(503, "VOICE_UNAVAILABLE", "No TTS in mock mode.");
  },
};
