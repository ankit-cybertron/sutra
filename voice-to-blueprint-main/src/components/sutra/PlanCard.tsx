import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Copy,
  Download,
  FileText,
  Layers,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/sutra/api";
import { planToMarkdown, slugify } from "@/lib/sutra/markdown";
import { evaluateProjectReadiness } from "@/lib/sutra/readiness";
import type { PlanDoc } from "@/lib/sutra/types";
import { cn } from "@/lib/utils";
import { ArchitectureDiagram } from "./ArchitectureDiagram";

const NAV = [
  ["overview", "Overview"],
  ["features", "Must-haves"],
  ["scope", "Scope"],
  ["build", "Build order"],
  ["tech", "Tech & risks"],
  ["diagram", "Architecture"],
  ["prompt", "Prompt"],
] as const;

function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-16 w-16 place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id="ring-g" x1="0" x2="1">
            <stop offset="0" stopColor="var(--saffron)" />
            <stop offset="0.5" stopColor="var(--rose)" />
            <stop offset="1" stopColor="var(--cobalt)" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--secondary)" strokeWidth="5" />
        <motion.circle
          cx="32" cy="32" r={r} fill="none" stroke="url(#ring-g)" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1.4, ease: [0.2, 0.7, 0.2, 1] }}
        />
      </svg>
      <span className="font-mono text-sm font-semibold tabular-nums">{score}</span>
    </div>
  );
}

function Section({ id, n, title, children }: { id: string; n: string; title: string; children: ReactNode }) {
  return (
    <motion.section
      id={`plan-${id}`}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      className="scroll-mt-44 border-t border-border px-6 py-10 sm:px-10"
    >
      <div className="mb-6 flex items-baseline gap-3">
        <span className="font-mono text-xs text-muted-foreground">{n}</span>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

function List({ items, icon, tone }: { items: string[]; icon: ReactNode; tone: string }) {
  return (
    <ul className="space-y-2.5">
      {items.map((x) => (
        <li key={x} className="flex gap-3 text-[15px] leading-relaxed">
          <span className={cn("mt-1 shrink-0", tone)}>{icon}</span>
          {x}
        </li>
      ))}
    </ul>
  );
}

export function PlanCard({ doc }: { doc: PlanDoc }) {
  const p = doc.plan;
  const readiness = useMemo(() => evaluateProjectReadiness(p), [p]);
  const [showChanges, setShowChanges] = useState(true);
  const [showReadinessBreakdown, setShowReadinessBreakdown] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => setShowChanges(true), [doc.version]);

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([planToMarkdown(doc)], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${slugify(p.title)}-v${doc.version}.md` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article className="overflow-clip rounded-[2rem] border border-border bg-card shadow-lift">
      {/* Header */}
      <header className="relative overflow-hidden px-6 pt-8 pb-8 sm:px-10 sm:pt-10">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-thread-soft blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-xs">{doc.id}</span>
          <AnimatePresence mode="popLayout">
            <motion.span
              key={doc.version}
              initial={{ y: -12, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0 }}
              className="rounded-full bg-primary px-2.5 py-1 font-mono text-xs text-primary-foreground"
            >
              v{doc.version}
            </motion.span>
          </AnimatePresence>
          <span className="eyebrow ml-1 text-muted-foreground">{p.language}</span>
        </div>
        <div className="relative mt-6 flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="display text-4xl text-balance sm:text-5xl">{p.title}</h1>
            <p className="mt-3 text-lg text-muted-foreground">{p.oneLiner}</p>
          </div>
          <div
            onClick={() => setShowReadinessBreakdown((s) => !s)}
            className="flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-2xl border border-transparent p-2 transition-all hover:border-border hover:bg-secondary/60"
            title="Click to view genuine 10-factor project readiness breakdown"
          >
            <ScoreRing score={readiness.overallScore} />
            <div className="flex items-center gap-0.5">
              <span className="eyebrow text-[10px] text-muted-foreground">Readiness</span>
              {showReadinessBreakdown ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        <div className="relative mt-7 flex flex-wrap gap-2">
          <Button
            variant="hero"
            size="sm"
            onClick={() => {
              copy(planToMarkdown(doc), "Markdown");
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? <Check /> : <ClipboardCopy />} Copy Markdown
          </Button>
          <Button variant="soft" size="sm" onClick={() => copy(p.firstPrompt, "First prompt")}>
            <Copy /> Copy first prompt
          </Button>
          <Button variant="soft" size="sm" onClick={download}>
            <Download /> Download .md
          </Button>
          <Button
            variant="soft"
            size="sm"
            onClick={() => setShowReadinessBreakdown((s) => !s)}
            className="text-xs font-mono"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            {showReadinessBreakdown ? "Hide assessment" : "Readiness breakdown"}
          </Button>
        </div>
      </header>

      {/* Dynamic 10-Factor Readiness Assessment Breakdown */}
      <AnimatePresence>
        {showReadinessBreakdown && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-b border-border bg-muted/20"
          >
            <div className="mx-6 my-6 rounded-2xl border border-border bg-card/90 p-5 shadow-sm sm:mx-10 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold tracking-tight">10-Factor Project Readiness Assessment</h3>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-mono text-[11px] font-medium",
                          readiness.grade === "Production Ready"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : readiness.grade === "High Readiness"
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : readiness.grade === "Moderate Readiness"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {readiness.grade} ({readiness.overallScore}/100)
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{readiness.summary}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReadinessBreakdown(false)}
                  className="cursor-pointer rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary"
                  aria-label="Close readiness breakdown"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Missing requirements & warnings callout */}
              {readiness.missingRequirements.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-foreground dark:border-amber-400/20 dark:bg-amber-400/5">
                  <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Areas Requiring Definition ({readiness.missingRequirements.length}):</span>
                  </div>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                    {readiness.missingRequirements.map((item, idx) => (
                      <li key={idx}>
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  {readiness.actionableSuggestions.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-1.5 border-t border-amber-500/20 pt-2 text-[11px] text-muted-foreground">
                      <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>
                        Tip: You can ask the Plan co-pilot on the right to refine any of these requirements (e.g. &ldquo;{readiness.actionableSuggestions[0]}&rdquo;).
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 10-Factor scorecard grid */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {readiness.factors.map((factor) => {
                  const pct = Math.round((factor.score / factor.weight) * 100);
                  const isFull = factor.status === "complete";
                  const isPart = factor.status === "partial";
                  return (
                    <div
                      key={factor.id}
                      className="flex flex-col justify-between rounded-xl border border-border/80 bg-background/50 p-3 transition-colors hover:border-border hover:bg-background"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground truncate" title={factor.name}>
                            {factor.name}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground shrink-0 ml-1">
                            {factor.score}/{factor.weight}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isFull ? "bg-emerald-500" : isPart ? "bg-amber-500" : "bg-rose-500"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] leading-snug text-muted-foreground line-clamp-3" title={factor.explanation}>
                          {factor.explanation}
                        </p>
                      </div>
                      <div className="mt-2.5 flex items-center gap-1 pt-1 border-t border-border/40 text-[10px]">
                        {isFull ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        ) : isPart ? (
                          <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                        ) : (
                          <X className="h-3 w-3 text-rose-500 shrink-0" />
                        )}
                        <span className={cn(isFull ? "text-emerald-600 dark:text-emerald-400" : isPart ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400", "font-medium capitalize")}>
                          {factor.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change summary */}
      <AnimatePresence>
        {doc.changeSummary.length > 0 && showChanges && (
          <motion.div
            key={doc.version}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-6 mb-6 rounded-2xl thread-border p-4 sm:mx-10">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-rose" /> What changed in v{doc.version}
                <button onClick={() => setShowChanges(false)} className="ml-auto cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-secondary" aria-label="Dismiss">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <ul className="mt-2 space-y-1 font-mono text-[13px]">
                {doc.changeSummary.map((c) => (
                  <li key={c} className={cn(c.startsWith("+") ? "text-success" : c.startsWith("−") || c.startsWith("-") ? "text-destructive" : "text-warning")}>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section nav */}
      <div className={cn("sticky z-20 border-y border-border bg-card/95 backdrop-blur-xl", isDemoMode ? "top-[5.6rem]" : "top-16")}>
        <div className="no-scrollbar flex gap-1 overflow-x-auto px-4 py-2 sm:px-8">
          {NAV.map(([id, l]) => (
            <a key={id} href={`#plan-${id}`} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              {l}
            </a>
          ))}
        </div>
      </div>

      <Section id="overview" n="01" title="Problem & core loop">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow text-muted-foreground">Target user</p>
            <p className="mt-2 text-[15px] leading-relaxed">{p.targetUser}</p>
          </div>
          <div>
            <p className="eyebrow text-muted-foreground">Problem</p>
            <p className="mt-2 text-[15px] leading-relaxed">{p.problem}</p>
          </div>
        </div>
        {p.coreLoop && (
          <ol className="mt-8 grid gap-3 sm:grid-cols-2">
            {p.coreLoop.map((s, i) => (
              <li key={s} className="flex gap-3 rounded-2xl bg-surface-2 p-4 text-[15px]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink font-mono text-[11px] text-ink-foreground">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section id="features" n="02" title="Must-have features">
        <div className="space-y-3">
          {p.mustHave.map((m, i) => (
            <motion.details
              key={m.name}
              open={i === 0}
              layout
              className="group rounded-2xl border border-border bg-card p-5 transition-shadow open:shadow-soft"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-secondary font-mono text-xs">{i + 1}</span>
                <span className="font-medium">{m.name}</span>
                <span className="ml-auto text-xs text-muted-foreground group-open:hidden">{m.acceptance.length} criteria</span>
              </summary>
              <p className="mt-3 pl-11 text-sm text-muted-foreground"><span className="font-medium text-foreground">Why: </span>{m.why}</p>
              <ul className="mt-3 space-y-1.5 pl-11">
                {m.acceptance.map((a) => (
                  <li key={a} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />{a}</li>
                ))}
              </ul>
            </motion.details>
          ))}
        </div>
      </Section>

      <Section id="scope" n="03" title="Scope boundaries">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-surface-2 p-5">
            <p className="eyebrow mb-4 text-cobalt">Later</p>
            <List items={p.later} icon={<Layers className="h-4 w-4" />} tone="text-cobalt" />
          </div>
          <div className="rounded-2xl bg-surface-2 p-5">
            <p className="eyebrow mb-4 text-destructive">Out of scope</p>
            <List items={p.outOfScope} icon={<X className="h-4 w-4" />} tone="text-destructive" />
          </div>
        </div>
      </Section>

      <Section id="build" n="04" title="Build order">
        <ol className="relative space-y-6 border-l border-border pl-8">
          {p.buildOrder.map((b) => (
            <li key={b.step} className="relative">
              <span className="absolute top-0 -left-[45px] grid h-7 w-7 place-items-center rounded-full border border-border bg-card font-mono text-[11px] shadow-soft">{b.step}</span>
              <p className="font-medium">{b.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="tech" n="05" title="Tech architecture & risks">
        <p className="rounded-2xl bg-surface-2 p-5 text-[15px] leading-relaxed">{p.techNotes}</p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow mb-4 text-warning">Risks</p>
            <List items={p.risks} icon={<AlertTriangle className="h-4 w-4" />} tone="text-warning" />
          </div>
          <div>
            <p className="eyebrow mb-4 text-muted-foreground">Assumptions</p>
            <List items={p.assumptions} icon={<Lightbulb className="h-4 w-4" />} tone="text-muted-foreground" />
          </div>
        </div>
        {p.openQuestions.length > 0 && (
          <div className="mt-6">
            <p className="eyebrow mb-3 text-muted-foreground">Open questions</p>
            <List items={p.openQuestions} icon={<span className="font-mono text-xs">?</span>} tone="text-rose" />
          </div>
        )}
      </Section>

      <Section id="diagram" n="06" title="Architecture diagram">
        <ArchitectureDiagram doc={doc} />
      </Section>

      <Section id="prompt" n="07" title="Prompt-ready launch block">
        <div className="overflow-hidden rounded-2xl bg-ink">
          <div className="flex items-center gap-2 border-b border-ink-border px-4 py-2.5">
            <FileText className="h-4 w-4 text-ink-muted" />
            <span className="font-mono text-xs text-ink-muted">first-prompt.md · Claude Code · Cursor · Codex</span>
            <Button variant="inkGhost" size="sm" className="ml-auto" onClick={() => copy(p.firstPrompt, "First prompt")}>
              <Copy /> Copy
            </Button>
          </div>
          <pre className="max-h-96 overflow-auto p-5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-ink-foreground/90">{p.firstPrompt}</pre>
        </div>
      </Section>
    </article>
  );
}
