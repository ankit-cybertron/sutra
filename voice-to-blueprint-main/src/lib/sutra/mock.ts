import type {
  Api,
  AnswerInput,
  ArchitectureDiagramResult,
  ChatInput,
  ChatResult,
  CreateSessionInput,
  CreateSessionResult,
  HealthResponse,
  Lang,
  Plan,
  PlanDoc,
  Question,
} from "./types";

// Offline stand-in for the Sutra backend so the UI is fully demoable with no keys.
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sessions = new Map<string, { idea: string; lang: Lang }>();
const plans = new Map<string, PlanDoc>();

const rid = (n = 3) =>
  Math.random()
    .toString(16)
    .slice(2, 2 + n)
    .toUpperCase();

export function detectLang(text: string): Lang {
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/\b(hai|hain|ke liye|mera|mere|meri|karna|chahiye|wala|wali|nahi|bhi|banana|kaise|kuch)\b/i.test(text))
    return "hinglish";
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
        options: ["बुकिंग करना", "पेमेंट करना", "स्टेटस देखना"],
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
        options: ["Booking karna", "Payment karna", "Status dekhna"],
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
      options: ["Book a slot", "Pay online", "Track status"],
    },
  ];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function buildPlan(idea: string, answers: AnswerInput[], lang: Lang): Plan {
  const short = idea.replace(/\s+/g, " ").trim();
  const platform = answers[0]?.text?.trim() || "a mobile-first web app";
  const core = answers[1]?.text?.trim() || "complete the main task in under a minute";
  const words = short.split(" ");
  const title = cap((words.length <= 8 ? short : words.slice(0, 6).join(" ") + "…").replace(/[.,!?]+$/, ""));
  const whatsapp = /whatsapp/i.test(short + platform);

  return {
    title,
    oneLiner: `A focused first version of: ${short.slice(0, 90)}${short.length > 90 ? "…" : ""}`,
    targetUser: `The first person who has this problem, reaching it through ${platform}.`,
    problem: `${cap(short.slice(0, 160))}. Today this is handled by hand — slow, scattered, and easy to get wrong.`,
    coreLoop: [
      "User opens the app and sees today's state at a glance",
      `User performs the key action: ${core}`,
      "System confirms instantly and notifies the right people",
      "Owner reviews the day's activity in one dashboard",
    ],
    readinessScore: 88 + Math.floor(Math.random() * 9),
    mustHave: [
      {
        name: "Core action in one tap",
        why: `The day-one job is to ${core.toLowerCase()}.`,
        acceptance: [
          "Action completes in ≤ 3 taps from the home screen",
          "Confirmation is shown within 1 second",
          "Works on a 3G connection with graceful retries",
        ],
      },
      {
        name: whatsapp ? "WhatsApp notifications" : "Smart notifications",
        why: "Users already live in their messaging apps; meet them there.",
        acceptance: [
          "Confirmation message sent within 10 seconds",
          "Reminder sent 1 hour before any scheduled event",
          "Users can opt out with a single reply",
        ],
      },
      {
        name: "Owner dashboard",
        why: "The operator needs one place to see everything happening today.",
        acceptance: ["Shows today's items sorted by time", "Updates live without refresh", "Exports to CSV"],
      },
      {
        name: "Simple sign-in",
        why: "Phone-number OTP removes password friction for Indian users.",
        acceptance: ["OTP delivered in < 15s", "Session persists for 30 days", "Rate-limited to 5 attempts/hour"],
      },
    ],
    later: ["Multi-location support", "Analytics & weekly reports", "Referral program", "Regional language UI packs"],
    outOfScope: ["Native iOS/Android apps", "In-house payment processing", "AI recommendations"],
    buildOrder: [
      { step: 1, title: "Data model & auth", detail: "Users, items, and events tables. Phone OTP sign-in with row-level access rules." },
      { step: 2, title: "Core action flow", detail: `Build the primary screen so a user can ${core.toLowerCase()} end-to-end.` },
      { step: 3, title: "Notifications", detail: "Queue-backed messaging with retries, templates, and opt-out handling." },
      { step: 4, title: "Owner dashboard", detail: "Live list view, filters, and CSV export. Ship behind an owner role." },
    ],
    techNotes:
      "React + TypeScript frontend, Postgres with row-level security, serverless functions for messaging webhooks, Redis queue for reminders. Host on an edge runtime.",
    risks: [
      "Messaging provider template approval can take 2–5 days",
      "Double-booking under concurrent requests — needs a DB-level unique constraint",
      "OTP abuse — enforce per-number and per-IP rate limits",
    ],
    assumptions: [`Primary channel is ${platform}`, "Single operator / single location for v1", "Payments handled offline initially"],
    openQuestions: ["Should cancellations be allowed after a cutoff time?", "Is there a need for staff accounts?"],
    suggestions: [
      { id: "s1", text: "Add rate limiting to the API", impact: "medium" },
      { id: "s2", text: "Include offline local caching", impact: "high" },
      { id: "s3", text: "Add a waitlist for full slots", impact: "low" },
    ],
    firstPrompt: `You are a senior full-stack engineer. Scaffold "${title}".\n\nGoal: ${short}\nPrimary channel: ${platform}\nDay-one job: ${core}\n\n1. Create a Postgres schema for users, items, events with RLS.\n2. Implement phone OTP auth.\n3. Build the core action screen (mobile-first, ≤ 3 taps).\n4. Add a notifications worker with retries.\n5. Ship an owner dashboard with live updates and CSV export.\n\nWrite tests for every acceptance criterion. Keep it simple; no native apps.`,
    language: lang,
  };
}

const REFINEMENTS: { match: RegExp; apply: (p: Plan) => { reply: string; changes: string[] } }[] = [
  {
    match: /rate.?limit/i,
    apply: (p) => {
      p.mustHave = [
        ...p.mustHave.slice(0, 4),
        {
          name: "API rate limiting",
          why: "Protects the backend from abuse and runaway costs.",
          acceptance: ["60 req/min per device", "429 with Retry-After header", "Limits visible in admin"],
        },
      ];
      p.risks = p.risks.filter((r) => !/OTP abuse/.test(r));
      return {
        reply: "Added API rate limiting as a must-have and retired the OTP-abuse risk it covers.",
        changes: ["+ Must-have: API rate limiting", "− Risk: OTP abuse (now mitigated)"],
      };
    },
  },
  {
    match: /offline|cach/i,
    apply: (p) => {
      p.techNotes += " Add a service worker with IndexedDB cache; queue writes offline and sync on reconnect.";
      p.buildOrder = [...p.buildOrder, { step: p.buildOrder.length + 1, title: "Offline mode", detail: "Service worker, IndexedDB cache, background sync queue." }];
      return {
        reply: "Offline caching is in. Writes queue locally and sync when the network returns.",
        changes: ["~ Tech notes: service worker + IndexedDB", `+ Build step ${p.buildOrder.length}: Offline mode`],
      };
    },
  },
  {
    match: /waitlist/i,
    apply: (p) => {
      p.later = ["Waitlist with auto-promotion", ...p.later];
      return { reply: "Waitlist added to the Later list — useful, but not required for launch.", changes: ["+ Later: Waitlist with auto-promotion"] };
    },
  },
];

function toMermaid(p: Plan): string {
  return `flowchart LR
  U([User]) --> FE[Web App]
  O([Owner]) --> DB_UI[Dashboard]
  FE --> API{{API Gateway}}
  DB_UI --> API
  API --> AUTH[OTP Auth]
  API --> CORE[${p.mustHave[0]?.name.replace(/[\[\]{}()"]/g, "") ?? "Core Service"}]
  CORE --> PG[(Postgres)]
  CORE --> Q[[Queue]]
  Q --> N[Notifications]
  N --> MSG([Messaging Provider])
  AUTH --> PG`;
}

export const mockApi: Api = {
  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    await delay(900);
    const lang = input.lang === "auto" ? detectLang(input.idea) : input.lang;
    const sessionId = `ses_${rid(8)}`;
    sessions.set(sessionId, { idea: input.idea, lang });
    return { sessionId, detectedLang: lang, questions: questionsFor(lang) };
  },
  async generatePlan(sessionId: string, answers: AnswerInput[]): Promise<PlanDoc> {
    await delay(3600);
    const s = sessions.get(sessionId) ?? { idea: "A new product idea", lang: "en" as Lang };
    const doc: PlanDoc = { id: `SUTRA-${rid(3)}`, version: 1, plan: buildPlan(s.idea, answers, s.lang), changeSummary: [] };
    plans.set(doc.id, doc);
    return structuredClone(doc);
  },
  async chat(planId: string, input: ChatInput): Promise<ChatResult> {
    await delay(1300);
    const doc = plans.get(planId);
    if (!doc) throw new Error("Plan not found");
    const r = REFINEMENTS.find((x) => x.match.test(input.message));
    if (!r) {
      const plan = structuredClone(doc.plan);
      plan.assumptions = [...plan.assumptions, cap(input.message.replace(/[.?!]+$/, ""))];
      const next: PlanDoc = { ...doc, version: doc.version + 1, plan, changeSummary: [`+ Assumption: ${cap(input.message)}`] };
      plans.set(planId, next);
      const reply = "Noted — I've recorded that as an assumption so the build stays consistent with it.";
      return { reply, spokenReply: reply, plan: structuredClone(next), changeSummary: next.changeSummary };
    }
    const plan = structuredClone(doc.plan);
    const { reply, changes } = r.apply(plan);
    plan.suggestions = plan.suggestions.filter((s) => !r.match.test(s.text));
    const next: PlanDoc = { ...doc, version: doc.version + 1, plan, changeSummary: changes };
    plans.set(planId, next);
    return { reply, spokenReply: reply, plan: structuredClone(next), changeSummary: changes };
  },
  async getPlan(planId: string) {
    const d = plans.get(planId);
    if (!d) throw new Error("Plan not found");
    return structuredClone(d);
  },
  async tts() {
    throw new Error("TTS not available in demo mode");
  },
  async health(): Promise<HealthResponse> {
    await delay(400);
    return {
      ok: true,
      status: "ok",
      app: "sutra",
      providers: { groq: { status: "mock", model: "demo" }, gnani: { status: "mock" } },
    };
  },
  async generateArchitectureDiagram(planId: string): Promise<ArchitectureDiagramResult> {
    await delay(1800);
    const d = plans.get(planId);
    if (!d) throw new Error("Plan not found");
    return { planId, mermaid: toMermaid(d.plan), model: "demo", status: "ok" };
  },
};
