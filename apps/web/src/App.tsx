import { useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  toApiError,
  type AnswerInput,
  type ChatMessage,
  type InputSource,
  type Lang,
  type LangMode,
  type PlanDoc,
  type Question,
} from "./api";
import { ChatPanel } from "./components/ChatPanel";
import { ClarifyPanel } from "./components/ClarifyPanel";
import { DemoBlock } from "./components/DemoBlock";
import { Footer } from "./components/Footer";
import { GeneratingPanel } from "./components/GeneratingPanel";
import { Hero } from "./components/Hero";
import { MicGate } from "./components/MicGate";
import { Nav } from "./components/Nav";
import { Notice, type NoticeState } from "./components/Notice";
import { PlanCard } from "./components/PlanCard";
import { Features, HowItWorks } from "./components/Sections";
import { useCountdown } from "./hooks/useCountdown";
import { useStateRef } from "./hooks/useStateRef";
import { LIMITS } from "./lib/config";
import { lsGet, lsRemove, lsSet } from "./lib/device";
import { t } from "./lib/i18n";
import { detectCommand, stripCommand } from "./lib/phrases";
import { cleanInput, clamp, countChars, joinSpeech } from "./lib/sanitize";
import { useSpeaker } from "./voice/useSpeaker";
import { useVoice } from "./voice/useVoice";

type Stage = "idle" | "clarifying" | "generating" | "plan";

const uid = () => Math.random().toString(36).slice(2, 10);
const LANG_KEY = "sutra.lang";
const TEXT_ONLY_KEY = "sutra.textonly";

function initialLang(): { lang: Lang; locked: boolean } {
  const saved = lsGet(LANG_KEY);
  if (saved === "en" || saved === "hi" || saved === "hinglish") return { lang: saved, locked: true };
  const nav = typeof navigator !== "undefined" ? navigator.language : "en";
  return { lang: nav.toLowerCase().startsWith("hi") ? "hi" : "en", locked: false };
}

function noticeFor(e: unknown): NoticeState {
  const err = e instanceof ApiError ? e : toApiError(e);
  switch (err.code) {
    case "RATE_LIMITED":
      return { kind: "rate", until: Date.now() + (err.retryAfter ?? 10) * 1000 };
    case "INPUT_BLOCKED":
      return { kind: "blocked" };
    case "INPUT_TOO_LONG":
      return { kind: "long" };
    case "INPUT_INVALID":
      return { kind: "invalid" };
    case "PROVIDER_UNAVAILABLE":
      return { kind: "provider" };
    case "VOICE_UNAVAILABLE":
      return { kind: "voice" };
    case "NETWORK":
      return { kind: "network" };
    case "NOT_FOUND":
      return { kind: "notfound" };
    default:
      return { kind: "generic" };
  }
}

export default function App() {
  const init = useRef(initialLang()).current;
  const [lang, setLangState, langRef] = useStateRef<Lang>(init.lang);
  const [langLocked, setLangLocked, langLockedRef] = useStateRef(init.locked);

  const [stage, setStage] = useState<Stage>("idle");
  const stageRef = useRef<Stage>("idle");
  stageRef.current = stage;

  const [idea, setIdea, ideaRef] = useStateRef("");
  const ideaSourceRef = useRef<InputSource>("text");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const answersRef = useRef<AnswerInput[]>([]);
  const [draft, setDraft, draftRef] = useStateRef("");
  const [doc, setDoc] = useState<PlanDoc | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft, chatDraftRef] = useStateRef("");
  const [partial, setPartial, partialRef] = useStateRef("");
  const [busy, setBusy, busyRef] = useStateRef(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [speakReplies, setSpeakReplies] = useState(true);
  const speakRepliesRef = useRef(true);
  speakRepliesRef.current = speakReplies;
  const [textOnly, setTextOnly] = useState(() => lsGet(TEXT_ONLY_KEY) === "1");
  const lastSubmit = useRef<Record<string, number>>({});

  const langMode: LangMode = langLocked ? lang : "auto";
  const rateLeft = useCountdown(notice?.kind === "rate" ? (notice.until ?? null) : null);
  const rateLimited = rateLeft > 0;

  const speaker = useSpeaker();

  // Voice callbacks are routed through a ref to the latest actions, so they never see stale state.
  const actions = useRef({
    submitIdea: (_directPlan?: boolean) => {},
    advance: (_skip: boolean) => {},
    sendChat: (_text: string, _source: InputSource) => {},
  });

  const voice = useVoice(langMode, {
    onPartial: (text) => setPartial(text),
    onSegment: (raw) => {
      const cmd = detectCommand(raw);
      const clean = cmd ? stripCommand(raw) : raw.trim();
      const st = stageRef.current;
      if (st === "idle") {
        if (clean) {
          ideaSourceRef.current = "voice";
          setIdea((p) => clamp(joinSpeech(p, clean), LIMITS.idea * 2));
        }
        if (cmd === "done") actions.current.submitIdea(true);
      } else if (st === "clarifying") {
        if (clean) setDraft((p) => clamp(joinSpeech(p, clean), LIMITS.answer * 2));
        if (cmd === "skip") actions.current.advance(true);
        else if (cmd === "done") actions.current.advance(false);
      } else if (st === "plan") {
        if (clean) setChatDraft((p) => clamp(joinSpeech(p, clean), LIMITS.chat * 2));
      }
      setPartial("");
    },
    onTurnEnd: () => {
      // 1. Commit any remaining uncommitted partial first
      const rem = partialRef.current.trim();
      if (rem) {
        if (stageRef.current === "idle") {
          ideaSourceRef.current = "voice";
          setIdea((p) => clamp(joinSpeech(p, rem), LIMITS.idea * 2));
        } else if (stageRef.current === "clarifying") {
          setDraft((p) => clamp(joinSpeech(p, rem), LIMITS.answer * 2));
        } else if (stageRef.current === "plan") {
          setChatDraft((p) => clamp(joinSpeech(p, rem), LIMITS.chat * 2));
        }
        setPartial("");
      }

      // 2. Auto-advance turn
      if (stageRef.current === "idle") {
        const text = ideaRef.current.trim() || rem;
        if (text) {
          actions.current.submitIdea(true);
        }
      } else if (stageRef.current === "plan") {
        const chatText = chatDraftRef.current.trim() || rem;
        if (chatText) {
          actions.current.sendChat(chatText, "voice");
        }
      }
    },
    onBargeIn: () => {
      speaker.stop();
      voiceRef.current.setSpeaking(false);
    },
    onError: (code) => {
      if (code === "rate_limited") setNotice({ kind: "rate", until: Date.now() + 15_000 });
      else if (code !== "denied" && code !== "unsupported") setNotice({ kind: "voice" });
    },
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  // ---- helpers -------------------------------------------------------------------------------

  const pickLang = (detected?: Lang): Lang => (langLockedRef.current || !detected ? langRef.current : detected);

  async function say(text: string, l: Lang): Promise<void> {
    const v = voiceRef.current;
    if (!speakRepliesRef.current || !v.preferred || v.status === "off" || v.status === "denied" || v.status === "unsupported") return;
    v.setSpeaking(true);
    await speaker.speak(text, l);
    window.setTimeout(() => voiceRef.current.setSpeaking(false), 300);
  }

  /** Per-action double-submit guard (UX only; the server enforces the real rate limits). */
  function tooSoon(kind: "idea" | "answer" | "plan" | "chat"): boolean {
    const now = Date.now();
    if (now - (lastSubmit.current[kind] ?? 0) < LIMITS.cooldownMs) return true;
    lastSubmit.current[kind] = now;
    return false;
  }

  function fail(e: unknown): void {
    setNotice(noticeFor(e));
  }

  // ---- flow ----------------------------------------------------------------------------------

  async function runPlan(sid: string, answers: AnswerInput[], l: Lang): Promise<void> {
    setStage("generating");
    setBusy(true);
    setNotice(null);
    try {
      const d = await api.generatePlan(sid, answers);
      setDoc(d);
      const hello = t(l, "chatHello");
      setMessages([{ id: uid(), role: "ai", text: hello, source: "text", ts: Date.now() }]);
      setStage("plan");
      window.history.replaceState(null, "", `#p=${d.id}`);
      lsSet("sutra.lastPlan", d.id);
      void say(hello, l);
    } catch (e) {
      fail(e);
      setStage(questions.length > 0 ? "clarifying" : "idle");
    } finally {
      setBusy(false);
    }
  }

  async function submitIdea(directPlan = false): Promise<void> {
    const activeText = partialRef.current ? (ideaRef.current ? `${ideaRef.current} ${partialRef.current}` : partialRef.current) : ideaRef.current;
    const text = cleanInput(activeText);
    if (!text) return setNotice({ kind: "invalid" });
    if (countChars(text) > LIMITS.idea) return setNotice({ kind: "long" });
    if (busyRef.current || tooSoon("idea")) return;
    setNotice(null);
    setBusy(true);
    setPartial("");
    try {
      const res = await api.createSession({ idea: text, lang: langLockedRef.current ? langRef.current : "auto", source: ideaSourceRef.current });
      if (!langLockedRef.current) setLangState(res.detectedLang);
      const l = pickLang(res.detectedLang);
      setSessionId(res.sessionId);
      answersRef.current = [];
      const qs = res.questions.slice(0, 2);
      setQuestions(qs);
      setQIndex(0);
      setDraft("");

      // If user came via voice or directPlan, send immediately to Groq to generate markdown plan!
      if (directPlan || ideaSourceRef.current === "voice" || qs.length === 0) {
        await runPlan(res.sessionId, [], l);
      } else {
        const first = qs[0];
        if (!first) {
          await runPlan(res.sessionId, [], l);
        } else {
          setStage("clarifying");
          void say(first.spokenText, l);
        }
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function advance(skip: boolean): Promise<void> {
    if (busyRef.current) return;
    const q = questions[qIndex];
    if (!q) return;
    const text = cleanInput(draftRef.current);
    if (!skip && !text) return; // nothing to submit yet
    if (!skip && countChars(text) > LIMITS.answer) return setNotice({ kind: "long" });
    if (tooSoon("answer")) return;
    if (!skip) answersRef.current = [...answersRef.current.filter((a) => a.questionId !== q.id), { questionId: q.id, text }];
    setNotice(null);
    speaker.stop();
    const l = pickLang();
    const nextQ = questions[qIndex + 1];
    if (nextQ) {
      setQIndex(qIndex + 1);
      setDraft("");
      void say(nextQ.spokenText, l);
    } else if (sessionId) {
      await runPlan(sessionId, answersRef.current, l);
    }
  }

  async function planNow(): Promise<void> {
    if (busyRef.current || !sessionId || tooSoon("plan")) return;
    const q = questions[qIndex];
    const text = cleanInput(draftRef.current);
    if (q && text) answersRef.current = [...answersRef.current.filter((a) => a.questionId !== q.id), { questionId: q.id, text }];
    speaker.stop();
    await runPlan(sessionId, answersRef.current, pickLang());
  }

  async function sendChat(raw: string, source: InputSource): Promise<void> {
    if (!doc || busyRef.current) return;
    const text = cleanInput(raw);
    if (!text) return;
    if (countChars(text) > LIMITS.chat) return setNotice({ kind: "long" });
    if (tooSoon("chat")) return;
    setNotice(null);
    setChatDraft("");
    setBusy(true);
    speaker.stop();
    setMessages((m) => [...m, { id: uid(), role: "user", text, source, ts: Date.now() }]);
    const l = langRef.current;
    try {
      const r = await api.chat(doc.id, { message: text, source, lang: l });
      setMessages((m) => {
        const next: ChatMessage[] = [...m, { id: uid(), role: "ai", text: r.reply, source: "text", ts: Date.now() }];
        if (r.plan) next.push({ id: uid(), role: "system", text: t(l, "planUpdated", { n: r.plan.version }), source: "text", ts: Date.now() });
        return next;
      });
      if (r.plan) setDoc(r.plan);
      void say(r.spokenReply, l);
    } catch (e) {
      fail(e);
      setChatDraft(text); // never lose the user's words on error
      setMessages((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  function newIdea(): void {
    speaker.stop();
    voiceRef.current.setSpeaking(false);
    setStage("idle");
    setIdea("");
    setDraft("");
    setChatDraft("");
    setPartial("");
    setQuestions([]);
    setQIndex(0);
    setSessionId(null);
    setDoc(null);
    setMessages([]);
    setNotice(null);
    answersRef.current = [];
    ideaSourceRef.current = "text";
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    window.scrollTo({ top: 0 });
  }

  actions.current = { submitIdea, advance, sendChat };

  // ---- effects -------------------------------------------------------------------------------

  // Auto-activate the mic on load if the user chose voice on a previous visit.
  useEffect(() => {
    if (voice.preferred && voice.status === "off") void voice.enable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore a plan from the URL hash (#p=<id>) after a reload.
  useEffect(() => {
    const m = /^#p=([\w-]+)$/.exec(window.location.hash);
    const id = m?.[1];
    if (!id) return;
    api
      .getPlan(id)
      .then((d) => {
        setDoc(d);
        setMessages([{ id: uid(), role: "ai", text: t(langRef.current, "chatHello"), source: "text", ts: Date.now() }]);
        setStage("plan");
      })
      .catch(() => window.history.replaceState(null, "", window.location.pathname + window.location.search));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "hi" ? "hi" : "en";
  }, [lang]);

  // Move focus to the answer box for keyboard/desktop users when a question appears.
  useEffect(() => {
    if (stage !== "clarifying") return;
    if (window.matchMedia("(pointer: fine)").matches) document.getElementById("answer")?.focus();
  }, [stage, qIndex]);

  // ---- ui wiring -----------------------------------------------------------------------------

  const setLang = (l: Lang) => {
    setLangState(l);
    setLangLocked(true);
    lsSet(LANG_KEY, l);
  };

  const onOrb = () => {
    const v = voiceRef.current;
    if (v.status === "off") {
      setTextOnly(false);
      lsRemove(TEXT_ONLY_KEY);
      void v.enable();
    } else if (v.status !== "needs-gesture") {
      v.toggleMute();
    }
  };

  const startSpeaking = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("idea")?.focus();
    if (voiceRef.current.status === "off") {
      setTextOnly(false);
      lsRemove(TEXT_ONLY_KEY);
      void voiceRef.current.enable();
    }
  };

  const noticeEl = notice ? <Notice notice={notice} lang={lang} onDismiss={() => setNotice(null)} /> : null;
  const gateEl = (
    <MicGate
      lang={lang}
      status={voice.status}
      textOnly={textOnly}
      onAllow={() => void voice.enable()}
      onTextOnly={() => {
        setTextOnly(true);
        lsSet(TEXT_ONLY_KEY, "1");
      }}
    />
  );
  const wake = voice.status === "needs-gesture" ? (
    <div className="wake" role="status">
      {t(lang, "vNeedsGesture")}
    </div>
  ) : null;

  return (
    <>
      <a className="skip" href="#main">
        {t(lang, "skipToContent")}
      </a>
      <Nav lang={lang} onLang={setLang} inWorkspace={stage !== "idle"} onNewIdea={newIdea} onStartSpeaking={startSpeaking} />
      {wake}
      <main id="main">
        {stage === "idle" && (
          <>
            <Hero
              lang={lang}
              idea={idea}
              partial={partial}
              busy={busy}
              rateLimited={rateLimited}
              voiceStatus={voice.status}
              voiceLevel={voice.level}
              onIdea={(v) => {
                ideaSourceRef.current = "text";
                setIdea(v);
              }}
              onSubmit={() => void submitIdea()}
              onOrb={onOrb}
              gate={gateEl}
              notice={noticeEl}
            />
            <HowItWorks />
            <DemoBlock />
            <Features />
          </>
        )}

        {stage === "clarifying" && (
          <ClarifyPanel
            lang={lang}
            idea={idea}
            questions={questions}
            index={qIndex}
            draft={draft}
            partial={partial}
            rateLimited={rateLimited}
            busy={busy}
            voiceStatus={voice.status}
            voiceLevel={voice.level}
            onDraft={setDraft}
            onNext={() => void advance(false)}
            onSkip={() => void advance(true)}
            onPlanNow={() => void planNow()}
            onOrb={onOrb}
            notice={noticeEl}
          />
        )}

        {stage === "generating" && <GeneratingPanel lang={lang} />}

        {stage === "plan" && doc && (
          <section className="work work-plan">
            <PlanCard doc={doc} lang={lang} />
            <ChatPanel
              lang={lang}
              messages={messages}
              suggestions={doc.plan.suggestions}
              draft={chatDraft}
              partial={partial}
              busy={busy}
              rateLimited={rateLimited}
              speakReplies={speakReplies}
              voiceStatus={voice.status}
              voiceLevel={voice.level}
              onDraft={setChatDraft}
              onSend={(text, source) => void sendChat(text, source)}
              onSpeakReplies={setSpeakReplies}
              onOrb={onOrb}
              notice={noticeEl}
            />
          </section>
        )}
      </main>
      <Footer lang={lang} />
    </>
  );
}
