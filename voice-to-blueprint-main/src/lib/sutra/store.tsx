import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "./api";
import type { AnswerInput, ChatMessage, InputSource, Lang, PlanDoc, Question } from "./types";

export type Stage = "idle" | "clarifying" | "generating" | "plan";
export const MAX_IDEA = 1200;

interface SutraState {
  stage: Stage;
  lang: Lang;
  idea: string;
  source: InputSource;
  sessionId: string | null;
  questions: Question[];
  qIndex: number;
  answers: AnswerInput[];
  doc: PlanDoc | null;
  messages: ChatMessage[];
  busy: boolean;
  chatBusy: boolean;
}

interface SutraActions {
  setLang: (l: Lang) => void;
  setIdea: (s: string, source?: InputSource) => void;
  reset: () => void;
  refine: () => Promise<void>;
  compile: () => Promise<void>;
  answer: (text: string) => void;
  skipQuestion: () => void;
  skipAll: () => void;
  sendChat: (text: string, source?: InputSource) => Promise<string | null>;
}

const Ctx = createContext<(SutraState & SutraActions) | null>(null);

const initial = (lang: Lang = "en"): SutraState => ({
  stage: "idle",
  lang,
  idea: "",
  source: "text",
  sessionId: null,
  questions: [],
  qIndex: 0,
  answers: [],
  doc: null,
  messages: [],
  busy: false,
  chatBusy: false,
});

const msg = (role: ChatMessage["role"], text: string, source: InputSource = "text"): ChatMessage => ({
  id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2),
  role,
  text,
  source,
  ts: Date.now(),
});

export function SutraProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<SutraState>(() => initial());
  const ref = useRef(s);
  ref.current = s;
  const patch = useCallback((p: Partial<SutraState>) => setS((prev) => ({ ...prev, ...p })), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const loadFromHash = () => {
      const m = window.location.hash.match(/[#&]p=([a-zA-Z0-9_]+)/);
      if (m && m[1]) {
        const planId = m[1];
        api.getPlan(planId).then((doc) => {
          patch({
            stage: "plan",
            doc,
            messages: [msg("ai", `Your plan "${doc.plan.title}" is ready. Ask me to change anything — scope, stack, risks — and I'll update the document live.`)],
          });
        }).catch(console.error);
      }
    };
    loadFromHash();
    window.addEventListener("hashchange", loadFromHash);
    return () => window.removeEventListener("hashchange", loadFromHash);
  }, [patch]);

  const runPlan = useCallback(
    async (sessionId: string, answers: AnswerInput[]) => {
      patch({ stage: "generating", answers });
      window.scrollTo({ top: 0, behavior: "smooth" });
      try {
        const doc = await api.generatePlan(sessionId, answers);
        patch({
          stage: "plan",
          doc,
          messages: [msg("ai", `Your plan "${doc.plan.title}" is ready. Ask me to change anything — scope, stack, risks — and I'll update the document live.`)],
        });
      } catch (e) {
        toast.error("Couldn't compile the plan", { description: (e as Error).message });
        patch({ stage: "idle" });
      }
    },
    [patch],
  );

  const start = useCallback(
    async (mode: "refine" | "compile") => {
      const { idea, lang, source } = ref.current;
      if (idea.trim().length < 8) {
        toast("Tell Sutra a little more", { description: "A sentence or two is enough to get started." });
        return;
      }
      patch({ busy: true });
      try {
        const res = await api.createSession({ idea: idea.trim(), lang, source });
        const targetLang = res.detectedLang || lang;
        if (mode === "refine" && res.questions.length) {
          patch({
            busy: false,
            sessionId: res.sessionId,
            stage: "clarifying",
            questions: res.questions,
            qIndex: 0,
            answers: [],
            lang: targetLang,
          });
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          patch({ busy: false, sessionId: res.sessionId, lang: targetLang });
          await runPlan(res.sessionId, []);
        }
      } catch (e) {
        patch({ busy: false });
        toast.error("Something went wrong", { description: (e as Error).message });
      }
    },
    [patch, runPlan],
  );

  const advance = useCallback(
    (answers: AnswerInput[]) => {
      const { qIndex, questions, sessionId } = ref.current;
      if (qIndex + 1 < questions.length) patch({ qIndex: qIndex + 1, answers });
      else if (sessionId) void runPlan(sessionId, answers);
    },
    [patch, runPlan],
  );

  const actions: SutraActions = useMemo(
    () => ({
      setLang: (lang) => patch({ lang }),
      setIdea: (idea, source) => patch({ idea: idea.slice(0, MAX_IDEA + 200), ...(source ? { source } : {}) }),
      reset: () => {
        setS((prev) => initial(prev.lang));
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
      refine: () => start("refine"),
      compile: () => start("compile"),
      answer: (text) => {
        const { questions, qIndex, answers } = ref.current;
        const q = questions[qIndex];
        if (!q) return;
        advance([...answers.filter((a) => a.questionId !== q.id), { questionId: q.id, text }]);
      },
      skipQuestion: () => advance(ref.current.answers),
      skipAll: () => {
        const { sessionId, answers } = ref.current;
        if (sessionId) void runPlan(sessionId, answers);
      },
      sendChat: async (text, source = "text") => {
        const { doc, lang } = ref.current;
        if (!doc || !text.trim()) return null;
        setS((p) => ({ ...p, chatBusy: true, messages: [...p.messages, msg("user", text.trim(), source)] }));
        try {
          const r = await api.chat(doc.id, { message: text.trim(), source, lang });
          setS((p) => ({
            ...p,
            chatBusy: false,
            doc: r.plan ?? p.doc,
            messages: [...p.messages, msg("ai", r.reply)],
          }));
          if (r.plan) toast.success(`Plan updated to v${r.plan.version}`, { description: r.changeSummary[0] });
          return r.spokenReply;
        } catch (e) {
          setS((p) => ({ ...p, chatBusy: false, messages: [...p.messages, msg("system", (e as Error).message)] }));
          return null;
        }
      },
    }),
    [patch, start, advance, runPlan],
  );

  return <Ctx.Provider value={{ ...s, ...actions }}>{children}</Ctx.Provider>;
}

export function useSutra() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSutra must be used inside SutraProvider");
  return c;
}
