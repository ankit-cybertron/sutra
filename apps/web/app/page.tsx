import { ThemeToggle } from "@/components/ThemeToggle";
import { Mic, ArrowRight, ShieldCheck, Cpu, Terminal } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Console Navigation Bar */}
      <header className="h-14 border-b border-line bg-surface/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center font-mono font-bold text-accent-ink text-sm shadow-sm">
            V
          </div>
          <span className="font-semibold text-ink tracking-tight text-base font-mono">
            VoxSpec
          </span>
          <span className="text-xs px-2 py-0.5 rounded border border-line bg-surface-2 text-ink-muted font-mono">
            v1.0-console
          </span>
        </div>

        {/* Stage Ribbon Preview */}
        <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-ink-muted">
          <span className="px-2.5 py-1 rounded-sm bg-accent/10 text-accent font-medium border border-accent/20">
            1. Talk
          </span>
          <span className="text-line">→</span>
          <span className="px-2.5 py-1 rounded-sm border border-line bg-surface-2">
            2. Intent
          </span>
          <span className="text-line">→</span>
          <span className="px-2.5 py-1 rounded-sm border border-line bg-surface-2">
            3. Gaps
          </span>
          <span className="text-line">→</span>
          <span className="px-2.5 py-1 rounded-sm border border-line bg-surface-2">
            4. Spec
          </span>
          <span className="text-line">→</span>
          <span className="px-2.5 py-1 rounded-sm border border-line bg-surface-2">
            5. Export
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="/projects"
            className="px-3.5 py-1.5 rounded-md bg-accent text-accent-ink text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            Launch Studio <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Studio Landing */}
      <main className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full px-6 py-16">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-line bg-surface text-ink-muted text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
            Studio Console Active · English + Hinglish Aware
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight text-ink leading-tight">
            Speak the messy idea.
            <br />
            <span className="text-accent italic">Ship the contract.</span>
          </h1>

          <p className="text-lg text-ink-muted font-serif max-w-2xl leading-relaxed">
            Turn self-correcting, code-mixed voice rambles into validated, versioned specs
            for AI coding agents with deterministic intent convergence.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <a
              href="/projects"
              className="px-5 py-2.5 rounded-md bg-accent text-accent-ink font-medium text-sm flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
            >
              <Mic className="w-4 h-4" /> Start Dictating
            </a>
            <a
              href="#benchmark"
              className="px-5 py-2.5 rounded-md border border-line bg-surface text-ink font-medium text-sm hover:bg-surface-2 transition-colors flex items-center gap-2"
            >
              <Terminal className="w-4 h-4 text-ink-muted" /> View Benchmark
            </a>
          </div>
        </div>

        {/* Console Feature Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 pt-12 border-t border-line">
          <div className="p-5 rounded-md border border-line bg-surface space-y-2">
            <div className="w-8 h-8 rounded bg-surface-2 border border-line flex items-center justify-center text-accent">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-ink text-sm">Intent Convergence</h3>
            <p className="text-xs text-ink-muted leading-relaxed font-sans">
              LLMs extract atomic claims; deterministic code resolves conflicts, tracks
              revisions, and scores readiness.
            </p>
          </div>

          <div className="p-5 rounded-md border border-line bg-surface space-y-2">
            <div className="w-8 h-8 rounded bg-surface-2 border border-line flex items-center justify-center text-ok">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-ink text-sm">Auditable Revision Trace</h3>
            <p className="text-xs text-ink-muted leading-relaxed font-sans">
              See exactly why a decision was reached, linked directly to transcript evidence
              spans with supersession history.
            </p>
          </div>

          <div className="p-5 rounded-md border border-line bg-surface space-y-2">
            <div className="w-8 h-8 rounded bg-surface-2 border border-line flex items-center justify-center text-warn">
              <Terminal className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-ink text-sm">Agent Bundle Export</h3>
            <p className="text-xs text-ink-muted leading-relaxed font-sans">
              Ship validated SPEC.md, architecture skeletons, acceptance criteria, and tuned
              prompts for Antigravity, Claude Code, and Cursor.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-line px-6 flex items-center justify-between text-xs text-ink-muted font-mono">
        <div>VoxSpec Studio · Research Benchmark & Specification Engine</div>
        <div className="flex items-center gap-4">
          <span>Light / Dark Ready</span>
          <span>WCAG 2.2 AA</span>
        </div>
      </footer>
    </div>
  );
}
