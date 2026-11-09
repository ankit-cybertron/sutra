"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase";
import {
  saveTranscript,
  transcribeAudio,
  readSSEStream,
  submitAnswers,
  fetchLatestSpec,
  Decision,
  RevisionTrace,
  Assumption,
  Question,
  SpecVersion,
  StageEvent,
} from "@/lib/api";
import {
  Mic,
  Square,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Loader2,
  HelpCircle,
  ChevronRight,
  RotateCcw,
  BookOpen,
  FileCode2,
  Terminal,
} from "lucide-react";

// Pre-packaged realistic sample rambles featuring Indian code-mixed Hinglish & self-corrections
const SAMPLE_RAMBLES = [
  {
    title: "Clinic Slots (Bangalore Physio)",
    text: "So I need a simple booking system for my physio clinic in Bangalore. Patients will pick a slot, and then the owner gets notified. Initially I thought owner dashboard mein jakar approve karega. Ruko nahi, owner is always on the move, so WhatsApp se direct approve karna chahiye. And payment abhi nahi chahiye, direct clinic aakar pay karenge. Wait, actually let's allow UPI link payment too if they want.",
    lang: "mixed",
  },
  {
    title: "QuickCommerce Dark Store Dispatch",
    text: "We want a dark store order picker app for delivery riders. The picker accepts the order, scans items one by one. Chhodo barcode scanner, camera OCR use karte hai pehle. If an item is out of stock, auto-replace with best alternative. Actually no, don't auto-replace, call customer directly. Retract auto-replacement completely because customers got angry last time.",
    lang: "mixed",
  },
  {
    title: "SaaS DevTool Incident Triage",
    text: "Building an automated incident runbook engine. When Datadog triggers a P1 alert, the bot creates a Slack channel and invites on-call engineers. It was supposed to auto-restart the kubernetes pods. Hold on, retract automated pod restarts, that is too risky without senior approval. Instead, output the kubectl command for human confirmation.",
    lang: "en",
  },
];

interface WorkspaceProps {
  params: Promise<{ id: string; sid: string }>;
}

export default function WorkspacePage({ params }: WorkspaceProps) {
  const router = useRouter();
  const { id: projectId, sid: sessionId } = use(params);

  // Auth & Token
  const [token, setToken] = useState<string | null>(null);

  // Workspace Navigation & View State
  const [activeTab, setActiveTab] = useState<"talk" | "spec">("talk");

  // Dictation / Transcript State
  const [rawText, setRawText] = useState("");
  const [langHint, setLangHint] = useState("mixed");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Analysis / Pipeline State
  const [analyzing, setAnalyzing] = useState(false);
  const [stages, setStages] = useState<Record<string, StageEvent>>({});
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [traces, setTraces] = useState<RevisionTrace[]>([]);
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Active Highlighted Span from Revision Trace
  const [highlightSpan, setHighlightSpan] = useState<{ start: number; end: number } | null>(null);

  // Spec Compilation State
  const [compiling, setCompiling] = useState(false);
  const [spec, setSpec] = useState<SpecVersion | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Session & Spec on Mount
  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      const sessionToken = data.session?.access_token || null;
      setToken(sessionToken);

      try {
        const existingSpec = await fetchLatestSpec(sessionId, sessionToken);
        if (existingSpec) {
          setSpec(existingSpec);
        }
      } catch {
        // No spec yet, default to talk tab
      }
    }
    init();
  }, [sessionId]);

  // Audio Recording with Gnani.ai STT Upload
  async function toggleRecording() {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
          stream.getTracks().forEach((track) => track.stop());

          try {
            const result = await transcribeAudio(audioBlob, langHint, token);
            if (result.text) {
              setRawText((prev) => (prev ? `${prev} ${result.text}` : result.text));
            }
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to transcribe audio via Gnani.ai");
          }
        };

        mediaRecorder.start(250);
        setIsRecording(true);
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } catch (err: unknown) {
        setError("Microphone access denied or unsupported in this browser.");
      }
    }
  }

  // Handle Pipeline Analysis (SSE)
  async function handleAnalyze() {
    if (!rawText.trim()) {
      setError("Please dictate or type your idea before extracting intent.");
      return;
    }
    setError(null);
    setAnalyzing(true);
    setStages({});

    try {
      // 1. Save transcript
      await saveTranscript(sessionId, rawText, langHint, token);

      // 2. Stream analyze stages
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/v1/sessions/${sessionId}/analyze`;
      await readSSEStream(url, token, null, {}, (event, data) => {
        if (event === "stage") {
          const stageEvt = data as unknown as StageEvent;
          setStages((prev) => ({ ...prev, [stageEvt.stage]: stageEvt }));
        } else if (event === "complete") {
          if (data.decisions) setDecisions(data.decisions as Decision[]);
          if (data.traces) setTraces(data.traces as RevisionTrace[]);
          if (data.assumptions) setAssumptions(data.assumptions as Assumption[]);
          if (data.questions) setQuestions(data.questions as Question[]);
        }
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis stream failed");
    } finally {
      setAnalyzing(false);
    }
  }

  // Handle Q&A Answers and Spec Compilation (SSE)
  async function handleCompile() {
    setCompiling(true);
    setError(null);

    try {
      // 1. Submit any answered questions
      const answerList = Object.entries(answers).map(([qid, text]) => ({
        question_id: qid,
        answer_text: text,
      }));
      if (answerList.length > 0) {
        await submitAnswers(sessionId, answerList, token);
      }

      // 2. Stream compile stages
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/v1/sessions/${sessionId}/compile`;
      await readSSEStream(
        url,
        token,
        null,
        { "Idempotency-Key": `comp-${sessionId}-${Date.now()}` },
        (event, data) => {
          if (event === "stage") {
            const stageEvt = data as unknown as StageEvent;
            setStages((prev) => ({ ...prev, [stageEvt.stage]: stageEvt }));
          } else if (event === "complete") {
            setSpec({
              id: String(data.spec_version_id),
              session_id: sessionId,
              spec_json: {},
              readiness_score: Number(data.readiness_score || 0),
              score_breakdown: (data.score_breakdown as any) || [],
              markdown_text: String(data.markdown || ""),
              created_at: new Date().toISOString(),
            });
            setActiveTab("spec");
          }
        }
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Spec compilation failed");
    } finally {
      setCompiling(false);
    }
  }

  // Copy First Agent Prompt
  function handleCopyPrompt() {
    if (!spec?.markdown_text) return;
    const match = spec.markdown_text.match(/## 9\. First agent prompt\s+```text\n([\s\S]*?)\n```/);
    const promptText = match ? match[1] : spec.markdown_text;
    navigator.clipboard.writeText(promptText);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }

  // Download SPEC.md
  function handleDownloadSpec() {
    if (!spec?.markdown_text) return;
    const blob = new Blob([spec.markdown_text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SPEC-${spec.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Render Transcript with Highlighting
  function renderHighlightedTranscript() {
    if (!highlightSpan || highlightSpan.start >= highlightSpan.end) {
      return <span>{rawText}</span>;
    }
    const before = rawText.slice(0, highlightSpan.start);
    const highlighted = rawText.slice(highlightSpan.start, highlightSpan.end);
    const after = rawText.slice(highlightSpan.end);

    return (
      <>
        <span>{before}</span>
        <mark className="bg-accent/30 text-ink rounded px-0.5 border border-accent/40 font-semibold transition-all">
          {highlighted}
        </mark>
        <span>{after}</span>
      </>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg text-ink">
      {/* Top Console Navigation */}
      <header className="h-14 border-b border-line bg-surface/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <a href="/projects" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center font-mono font-bold text-accent-ink text-sm shadow-sm">
              V
            </div>
            <span className="font-semibold text-ink tracking-tight text-base font-mono">
              VoxSpec
            </span>
          </a>
          <span className="text-line">/</span>
          <span className="text-xs font-mono text-ink-muted">Session {sessionId.slice(0, 8)}</span>
        </div>

        {/* Real-time Stage Ribbon */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono">
          {[
            { key: "normalize", label: "1. Talk" },
            { key: "extract", label: "2. Claims" },
            { key: "resolve", label: "3. Intent" },
            { key: "gaps", label: "4. Gaps" },
            { key: "compile", label: "5. Spec" },
          ].map((st, idx) => {
            const cur = stages[st.key];
            const isDone = cur?.status === "done";
            const isStarted = cur?.status === "started";
            const isFailed = cur?.status === "failed";

            return (
              <div key={st.key} className="flex items-center gap-1.5">
                <span
                  className={`px-2.5 py-1 rounded text-xs transition-colors border ${
                    isDone
                      ? "bg-ok/10 text-ok border-ok/30 font-medium"
                      : isStarted
                      ? "bg-accent/10 text-accent border-accent/40 animate-pulse font-medium"
                      : isFailed
                      ? "bg-danger/10 text-danger border-danger/30"
                      : "bg-surface-2 text-ink-muted border-line"
                  }`}
                >
                  {st.label}
                  {cur?.ms ? ` (${cur.ms}ms)` : ""}
                </span>
                {idx < 4 && <span className="text-line text-xs">→</span>}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => router.push("/projects")}
            className="text-xs font-mono px-3 py-1.5 rounded border border-line bg-surface hover:bg-surface-2 transition-colors cursor-pointer"
          >
            Exit Workspace
          </button>
        </div>
      </header>

      {/* Main 3-Pane Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* CENTER PANE: Talk or Spec View */}
        <div className="flex-1 flex flex-col border-r border-line bg-bg min-w-0">
          {/* Workspace Tabs Header */}
          <div className="h-12 border-b border-line px-6 flex items-center justify-between bg-surface/50">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("talk")}
                className={`px-3.5 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "talk"
                    ? "bg-surface text-ink border border-line shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                <Mic className="w-3.5 h-3.5" /> Dictation Workspace
              </button>
              <button
                onClick={() => setActiveTab("spec")}
                className={`px-3.5 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "spec"
                    ? "bg-surface text-ink border border-line shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" /> Compiled Specification
                {spec && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-ok/10 text-ok text-[10px] font-mono font-bold">
                    {spec.readiness_score}/100
                  </span>
                )}
              </button>
            </div>

            {/* Language & Samples Selector */}
            {activeTab === "talk" && (
              <div className="flex items-center gap-2">
                <select
                  value={langHint}
                  onChange={(e) => setLangHint(e.target.value)}
                  className="text-xs px-2 py-1 rounded border border-line bg-surface-2 text-ink font-mono focus:outline-none"
                >
                  <option value="mixed">Language: Mixed (En + Hi)</option>
                  <option value="en">Language: English</option>
                  <option value="hi-Latn">Language: Hinglish</option>
                  <option value="hi">Language: Hindi (Devanagari)</option>
                </select>

                <select
                  onChange={(e) => {
                    const sample = SAMPLE_RAMBLES.find((s) => s.title === e.target.value);
                    if (sample) {
                      setRawText(sample.text);
                      setLangHint(sample.lang);
                    }
                  }}
                  defaultValue=""
                  className="text-xs px-2 py-1 rounded border border-line bg-surface-2 text-ink font-mono focus:outline-none cursor-pointer"
                >
                  <option value="" disabled>
                    Paste Sample Ramble...
                  </option>
                  {SAMPLE_RAMBLES.map((s) => (
                    <option key={s.title} value={s.title}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && (
            <div className="m-4 p-3 rounded border border-danger/30 bg-danger/10 text-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: TALK & DICTATION */}
          {activeTab === "talk" ? (
            <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
              <div className="flex-1 flex flex-col border border-line rounded-lg bg-surface relative shadow-sm">
                {/* Highlighted Render Overlay when Hovering Evidence Span */}
                {highlightSpan && (
                  <div className="absolute inset-0 p-4 font-sans text-sm leading-relaxed overflow-y-auto pointer-events-none whitespace-pre-wrap z-10 bg-surface/90">
                    {renderHighlightedTranscript()}
                  </div>
                )}

                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleAnalyze();
                    }
                  }}
                  placeholder="Speak or paste your rambling idea here in English, Hindi, or Hinglish... Self-corrections like 'ruko nahi, dashboard nahi WhatsApp use karo' are tracked automatically."
                  maxLength={12000}
                  className="flex-1 p-4 bg-transparent text-ink placeholder:text-ink-muted/50 text-sm font-sans leading-relaxed resize-none focus:outline-none min-h-[320px]"
                />

                {/* Textarea Bottom Toolbar */}
                <div className="h-12 border-t border-line px-4 flex items-center justify-between text-xs font-mono text-ink-muted bg-surface-2/40">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-all cursor-pointer ${
                        isRecording
                          ? "bg-danger text-white animate-pulse"
                          : "border border-line bg-surface hover:text-ink hover:border-accent"
                      }`}
                    >
                      {isRecording ? (
                        <>
                          <Square className="w-3.5 h-3.5" /> Recording ({recordingTime}s)
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-accent" /> Dictate (Gnani.ai)
                        </>
                      )}
                    </button>
                    <span>
                      {rawText.trim() ? rawText.trim().split(/\s+/).length : 0} words · {rawText.length} / 12,000 chars
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline text-ink-muted/70">
                      Press <kbd className="px-1.5 py-0.5 rounded border border-line bg-surface text-ink font-mono text-[11px]">⌘+Enter</kbd>
                    </span>
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={analyzing || !rawText.trim()}
                      className="px-4 py-1.5 rounded-md bg-accent text-accent-ink font-medium text-xs hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting Intent...
                        </>
                      ) : (
                        <>
                          Extract Intent <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Informational Hint Bar */}
              <div className="p-3 rounded-md border border-line bg-surface-2 text-xs font-mono text-ink-muted flex items-center justify-between">
                <span>Deterministic Intent Convergence Resolver ready. Model: Groq (Llama 3.3 70B) · STT: Gnani.ai</span>
                <span className="text-accent">6 Invariants Verified</span>
              </div>
            </div>
          ) : (
            /* TAB 2: SPEC VIEWER */
            <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
              {spec ? (
                <div className="space-y-6 max-w-4xl">
                  {/* Top Spec Action Bar */}
                  <div className="p-4 rounded-lg border border-line bg-surface flex flex-wrap items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border border-ok/40 bg-ok/10 flex items-center justify-center font-mono font-bold text-ok text-base">
                        {spec.readiness_score}
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-ink">Readiness Score: {spec.readiness_score}/100</h2>
                        <p className="text-xs text-ink-muted font-mono">
                          {spec.readiness_score >= 85 ? "✓ Build-Ready Contract" : "Needs gap resolution"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyPrompt}
                        className="px-3.5 py-1.5 rounded-md border border-line bg-surface text-ink text-xs font-medium hover:bg-surface-2 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-accent" />
                        {copyFeedback ? "Copied Prompt!" : "Copy First Prompt"}
                      </button>
                      <button
                        onClick={handleDownloadSpec}
                        className="px-3.5 py-1.5 rounded-md bg-accent text-accent-ink text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" /> Download SPEC.md
                      </button>
                    </div>
                  </div>

                  {/* Rendered Markdown Spec Document */}
                  <article className="p-8 rounded-lg border border-line bg-surface shadow-sm prose dark:prose-invert max-w-none font-serif leading-relaxed text-ink">
                    <div className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed">
                      {spec.markdown_text}
                    </div>
                  </article>
                </div>
              ) : (
                <div className="p-12 text-center rounded-lg border border-line border-dashed bg-surface/50 space-y-3">
                  <FileCode2 className="w-8 h-8 text-ink-muted mx-auto" />
                  <h3 className="text-sm font-semibold text-ink">No spec compiled yet</h3>
                  <p className="text-xs text-ink-muted max-w-sm mx-auto">
                    Dictate your product ramble in the Talk tab and extract intent. Once questions are answered, compile your authoritative SPEC.md contract.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANE: INTENT & GAPS PANEL (SIGNATURE REVISION TRACE) */}
        <aside className="w-full md:w-[420px] lg:w-[480px] border-t md:border-t-0 md:border-l border-line bg-surface flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2/30 sticky top-0 z-20">
            <h2 className="text-xs font-mono font-bold tracking-wider text-ink uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent" /> Intent & Convergence Panel
            </h2>
            <span className="text-[11px] font-mono text-ink-muted">
              {decisions.length} Decisions · {traces.length} Traces
            </span>
          </div>

          <div className="p-4 space-y-6">
            {/* 1. SIGNATURE REVISION TRACE ("What Changed Your Mind") */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-semibold text-ink flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-accent" /> REVISION TRACE
                </h3>
                <span className="text-[11px] font-mono text-ink-muted">Hover to highlight transcript</span>
              </div>

              {traces.length === 0 ? (
                <div className="p-4 rounded border border-line bg-surface-2 text-xs text-ink-muted text-center font-mono">
                  No revisions detected yet. Dictate your ramble to begin intent convergence.
                </div>
              ) : (
                <div className="space-y-2">
                  {traces.map((trace) => (
                    <div key={trace.topic} className="p-3 rounded-md border border-line bg-surface-2/60 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-accent">{trace.topic}</span>
                        <span className="text-[10px] font-mono text-ink-muted">{trace.steps.length} steps</span>
                      </div>

                      {/* Horizontal revision evolution chain */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {trace.steps.map((st, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onMouseEnter={() => setHighlightSpan(st.span)}
                              onMouseLeave={() => setHighlightSpan(null)}
                              className={`px-2 py-0.5 rounded text-xs font-sans transition-all cursor-pointer ${
                                st.superseded
                                  ? "line-through text-ink-muted bg-surface/50 border border-line"
                                  : st.stance === "retract"
                                  ? "text-danger bg-danger/10 border border-danger/30 font-medium"
                                  : "text-ok bg-ok/10 border border-ok/30 font-semibold"
                              }`}
                            >
                              {st.value}
                            </button>
                            {i < trace.steps.length - 1 && <span className="text-ink-muted text-xs">→</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. FINAL INTENT DECISIONS */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono font-semibold text-ink flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> CONVERGED INTENT DECISIONS
              </h3>

              {decisions.length === 0 ? (
                <div className="p-4 rounded border border-line bg-surface-2 text-xs text-ink-muted text-center font-mono">
                  Pending extraction...
                </div>
              ) : (
                <div className="space-y-2">
                  {decisions.map((d) => (
                    <div key={d.topic} className="p-3 rounded-md border border-line bg-surface space-y-1">
                      <div className="text-xs font-mono text-ink-muted">{d.topic}</div>
                      <div className="text-sm font-semibold text-ink">{d.final}</div>
                      {d.superseded.length > 0 && (
                        <div className="text-[11px] text-ink-muted font-sans">
                          Superseded: <span className="line-through">{d.superseded.join(", ")}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. ASSUMPTIONS */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono font-semibold text-ink flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-warn" /> ASSUMPTIONS IDENTIFIED
              </h3>

              {assumptions.length === 0 ? (
                <div className="p-4 rounded border border-line bg-surface-2 text-xs text-ink-muted text-center font-mono">
                  No active assumptions.
                </div>
              ) : (
                <div className="space-y-2">
                  {assumptions.map((asm) => (
                    <div key={asm.id} className="p-3 rounded-md border border-line bg-surface flex items-start gap-2">
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-bold shrink-0 mt-0.5 ${
                          asm.risk === "high"
                            ? "bg-danger/10 text-danger border border-danger/30"
                            : asm.risk === "medium"
                            ? "bg-warn/10 text-warn border border-warn/30"
                            : "bg-ok/10 text-ok border border-ok/30"
                        }`}
                      >
                        {asm.risk}
                      </span>
                      <p className="text-xs text-ink leading-relaxed font-sans">{asm.statement}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. HIGH-IMPACT QUESTIONS & COMPILE ACTION */}
            <div className="space-y-3 pt-2 border-t border-line">
              <h3 className="text-xs font-mono font-semibold text-ink flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-accent" /> GAP ANALYSIS QUESTIONS (≤3)
              </h3>

              {questions.length === 0 ? (
                <div className="p-4 rounded border border-line bg-surface-2 text-xs text-ink-muted text-center font-mono">
                  No blocking questions.
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((q) => (
                    <div key={q.id} className="p-3 rounded-md border border-line bg-surface space-y-2">
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-ink">{q.text}</span>
                        <p className="text-[11px] text-ink-muted leading-relaxed">{q.why_it_matters}</p>
                      </div>

                      {/* Quick Option Buttons */}
                      {q.options && q.options.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {q.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                              className={`text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                                answers[q.id] === opt
                                  ? "bg-accent text-accent-ink border-accent font-medium"
                                  : "bg-surface-2 border-line text-ink hover:border-accent/40"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Custom Answer Input */}
                      <input
                        type="text"
                        value={answers[q.id] || ""}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                        placeholder="Or write custom resolution..."
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-line bg-surface-2 text-ink placeholder:text-ink-muted/50 focus:border-focus focus:outline-none"
                      />
                    </div>
                  ))}

                  {/* Compile Action Button */}
                  <button
                    type="button"
                    onClick={handleCompile}
                    disabled={compiling || decisions.length === 0}
                    className="w-full py-2.5 px-4 rounded-md bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 shadow-sm cursor-pointer mt-4"
                  >
                    {compiling ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Compiling Spec & Scoring...
                      </>
                    ) : (
                      <>
                        Compile Build-Ready Spec <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
