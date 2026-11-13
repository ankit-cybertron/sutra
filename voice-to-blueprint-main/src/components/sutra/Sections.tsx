import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useScroll, useTransform, type MotionValue } from "motion/react";
import { ArrowUpRight, FileCode2, Lock, MessageCircleQuestion, Mic, Network, Zap } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SAMPLE_IDEAS } from "@/lib/sutra/i18n";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { Reveal } from "./Reveal";
import { MIC_EVENT } from "./Hero";
import { VoiceOrb } from "./VoiceOrb";
import { Magnetic } from "./motion/Magnetic";
import { Marquee } from "./motion/Marquee";
import { ShaderField } from "./motion/ShaderField";

const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

function spot(e: React.PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

function Counter({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1400);
      setV(to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);
  return (
    <span ref={ref} className="tabular-nums">
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ---------------- Marquee band + stats ---------------- */
const WORDS = ["Bolo", "Speak", "बोलो", "Ramble", "Clarify", "बनाओ", "Ship"];

export function MarqueeBand() {
  return (
    <section className="relative overflow-hidden py-16">
      <Marquee duration={30}>
        {WORDS.map((w, i) => (
          <span key={w} className="flex items-center">
            <span className={cn("display px-6 text-[clamp(3.5rem,9vw,8rem)]", i % 2 ? "text-outline" : "text-foreground")}>{w}</span>
            <span className="h-4 w-4 rounded-full bg-thread" />
          </span>
        ))}
      </Marquee>
      <Marquee duration={45} reverse className="mt-6">
        {SAMPLE_IDEAS.concat(["Kirana stock alerts on WhatsApp", "Tuition fee tracker for coaching classes", "Hostel mess menu voting"]).map((s) => (
          <span key={s} className="mx-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm whitespace-nowrap text-muted-foreground shadow-soft">
            “{s}”
          </span>
        ))}
      </Marquee>

      <div className="mx-auto mt-24 grid max-w-7xl 2xl:max-w-[1720px] grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border bg-border px-0 md:grid-cols-4">
        {[
          { v: <Counter to={3} suffix="×" />, l: "faster than typing" },
          { v: <Counter to={2.8} decimals={1} suffix="s" />, l: "median compile time" },
          { v: <Counter to={3} />, l: "languages, code-mixed" },
          { v: <Counter to={0} suffix=" docs" />, l: "written by hand" },
        ].map((s, i) => (
          <Reveal key={i} delay={i * 0.08} className="bg-card px-6 py-10 text-center">
            <p className="display text-5xl sm:text-6xl">{s.v}</p>
            <p className="mt-2 text-sm text-muted-foreground">{s.l}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Horizontal steps ---------------- */
function WaveVisual() {
  return (
    <div className="flex h-24 items-center gap-1.5">
      {Array.from({ length: 32 }).map((_, i) => (
        <motion.span
          key={i}
          className="w-1.5 rounded-full bg-thread"
          animate={{ height: [8, 16 + ((i * 41) % 70), 8] }}
          transition={{ duration: 1 + (i % 5) * 0.15, repeat: Infinity, ease: "easeInOut", delay: i * 0.03 }}
        />
      ))}
    </div>
  );
}
function ChipsVisual() {
  const opts = ["Phone app", "Website", "WhatsApp"];
  const [pick, setPick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPick((p) => (p + 1) % opts.length), 1400);
    return () => clearInterval(t);
  }, [opts.length]);
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o, i) => (
        <motion.span key={o} layout className={cn("rounded-full border px-4 py-2 text-sm transition-colors duration-300", pick === i ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
          {o}
        </motion.span>
      ))}
    </div>
  );
}
function DocVisual() {
  const lines = ["# Clinic Slots", "## Must-have", "- [x] WhatsApp booking", "- [x] 1h reminders", "## Build order", "1. Data model & auth"];
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v >= lines.length ? 0 : v + 1)), 600);
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <pre className="h-40 overflow-hidden rounded-2xl bg-ink p-4 font-mono text-xs leading-relaxed text-ink-foreground/85">
      {lines.slice(0, n).map((l) => (
        <motion.div key={l} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>{l}</motion.div>
      ))}
      <span className="inline-block h-3.5 w-1.5 animate-pulse bg-saffron" />
    </pre>
  );
}

const STEPS = [
  { icon: Mic, title: "Ramble", body: "Talk like you would to a co-founder. English, Hindi, Hinglish — mid-sentence switches welcome.", visual: <WaveVisual /> },
  { icon: MessageCircleQuestion, title: "Clarify", body: "One or two sharp questions resolve the ambiguities that sink most MVPs. Tap a chip or just answer out loud.", visual: <ChipsVisual /> },
  { icon: FileCode2, title: "Export", body: "PRD, acceptance criteria, build order, architecture diagram and a first prompt for your coding agent.", visual: <DocVisual /> },
];

export function HorizontalSteps() {
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  useIsoLayout(() => {
    const m = () => setDist(Math.max(0, (track.current?.scrollWidth ?? 0) - window.innerWidth));
    m();
    window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, (v) => -v * dist);
  const bar = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section id="how" ref={ref} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <motion.div ref={track} style={{ x }} className="flex w-max items-stretch gap-6 px-[6vw]">
          <div className="flex w-[80vw] shrink-0 flex-col justify-center sm:w-[42vw]">
            <p className="eyebrow text-rose">How it works</p>
            <h2 className="display mt-4 text-[clamp(3rem,6vw,5.5rem)]">
              Three steps.
              <br />
              <span className="text-muted-foreground/60">Zero docs written.</span>
            </h2>
            <p className="mt-6 max-w-sm text-muted-foreground">Keep scrolling — every step is live.</p>
          </div>
          {STEPS.map((s, i) => (
            <StepCard key={s.title} i={i} step={s} progress={scrollYProgress} />
          ))}
        </motion.div>
        <div className="mx-auto mt-10 h-[2px] w-[min(88vw,1100px)] overflow-hidden rounded-full bg-border">
          <motion.div style={{ width: bar }} className="h-full bg-thread" />
        </div>
      </div>
    </section>
  );
}

function StepCard({ i, step, progress }: { i: number; step: (typeof STEPS)[number]; progress: MotionValue<number> }) {
  const rotate = useTransform(progress, [0, 1], [4 - i * 2, -4 + i * 2]);
  return (
    <motion.div
      style={{ rotate }}
      onPointerMove={spot}
      className="group relative flex h-[min(70vh,560px)] w-[80vw] shrink-0 flex-col justify-between overflow-hidden rounded-[2rem] border border-border bg-card p-8 shadow-lift sm:w-[46vw] sm:p-12"
    >
      <div className="pointer-events-none absolute inset-0 spotlight opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative flex items-start justify-between">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-ink-foreground">
          <step.icon className="h-6 w-6" strokeWidth={1.7} />
        </span>
        <span className="display text-outline text-[8rem] leading-none">0{i + 1}</span>
      </div>
      <div className="relative">{step.visual}</div>
      <div className="relative">
        <h3 className="display text-4xl sm:text-5xl">{step.title}</h3>
        <p className="mt-3 max-w-md text-lg text-muted-foreground">{step.body}</p>
      </div>
    </motion.div>
  );
}

/* ---------------- Stacked feature cards ---------------- */
const GREETINGS = ["Namaste", "नमस्ते", "Kya haal hai?", "Let's build", "चलो बनाते हैं"];
function Greeter() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % GREETINGS.length), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative h-28 w-full overflow-hidden">
      <AnimatePresence mode="popLayout">
        <motion.p
          key={i}
          initial={{ y: 80, opacity: 0, rotateX: -60 }}
          animate={{ y: 0, opacity: 1, rotateX: 0 }}
          exit={{ y: -80, opacity: 0, rotateX: 60 }}
          transition={{ type: "spring", stiffness: 180, damping: 20 }}
          className="display absolute text-7xl text-thread sm:text-8xl"
        >
          {GREETINGS[i]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
function SpeedVisual() {
  return (
    <div className="w-full">
      <p className="display text-8xl sm:text-9xl">
        <Counter to={2.8} decimals={1} />
        <span className="text-4xl text-muted-foreground">s</span>
      </p>
      <div className="mt-6 space-y-2">
        {[["Typing a PRD", "100%", "bg-muted-foreground/30"], ["Sutra", "6%", "bg-thread"]].map(([l, w, c]) => (
          <div key={l} className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="w-24">{l}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <motion.div className={cn("h-full rounded-full", c)} initial={{ width: 0 }} whileInView={{ width: w ?? "0%" }} viewport={{ once: true }} transition={{ duration: 1.2, ease: "easeOut" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function GraphVisual() {
  const nodes = [
    { x: 20, y: 60, l: "App" },
    { x: 130, y: 20, l: "API" },
    { x: 130, y: 100, l: "Auth" },
    { x: 240, y: 60, l: "DB" },
    { x: 240, y: 130, l: "Queue" },
  ];
  const edges: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 3], [1, 4]];
  return (
    <svg viewBox="0 0 300 160" className="w-full">
      {edges.map(([a, b], i) => (
        <motion.path
          key={i}
          d={`M${nodes[a]!.x + 44} ${nodes[a]!.y} C ${nodes[a]!.x + 80} ${nodes[a]!.y}, ${nodes[b]!.x - 36} ${nodes[b]!.y}, ${nodes[b]!.x} ${nodes[b]!.y}`}
          fill="none" stroke="var(--rose)" strokeWidth="1.5"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.15, duration: 0.7 }}
        />
      ))}
      {nodes.map((n, i) => (
        <motion.g key={n.l} initial={{ opacity: 0, scale: 0.5 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1, type: "spring" }}>
          <rect x={n.x} y={n.y - 14} width="44" height="28" rx="9" fill="var(--card)" stroke="var(--border)" />
          <text x={n.x + 22} y={n.y + 4} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--foreground)">{n.l}</text>
        </motion.g>
      ))}
      <motion.circle r="3" fill="var(--saffron)" animate={{ cx: [64, 130, 240], cy: [60, 20, 60] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
    </svg>
  );
}

const FEATURES: { eyebrow: string; title: string; body: string; icon: typeof Zap; visual: ReactNode; dark?: boolean }[] = [
  { eyebrow: "Voice", title: "Indic voice capture", body: "Gnani.ai speech recognition tuned for Indian English, Hindi and code-mixed Hinglish. Barge-in, “done” and “skip” voice commands built in.", icon: Mic, visual: <Greeter /> },
  { eyebrow: "Speed", title: "Groq-fast compile", body: "Full plans compile on Groq LPUs in a couple of seconds — faster than you can open a Google Doc.", icon: Zap, visual: <SpeedVisual /> },
  { eyebrow: "Architecture", title: "Live system diagrams", body: "Gemini synthesises a Mermaid architecture diagram from your plan. Zoom, copy the code or download SVG.", icon: Network, visual: <GraphVisual /> },
  {
    eyebrow: "Export", title: "Prompt-ready for agents", body: "Copy one prompt into Claude Code, Cursor or Codex and start scaffolding immediately.", icon: FileCode2, dark: true,
    visual: (
      <pre className="w-full overflow-hidden rounded-2xl bg-ink-foreground/[0.06] p-5 font-mono text-xs leading-relaxed text-ink-muted">{`You are a senior full-stack engineer.
Scaffold "Clinic Slots".

1. Postgres schema with RLS
2. Phone OTP auth
3. Booking flow ≤ 3 taps
4. Reminder worker w/ retries`}</pre>
    ),
  },
  { eyebrow: "Privacy", title: "Private by default", body: "Audio is streamed, transcribed and discarded. Plans live on your device unless you export them.", icon: Lock, visual: <motion.div className="grid h-32 w-32 place-items-center rounded-[2rem] bg-thread-soft" animate={{ rotate: [0, 6, -6, 0] }} transition={{ duration: 5, repeat: Infinity }}><Lock className="h-12 w-12" strokeWidth={1.4} /></motion.div> },
];

function FeatureCard({ f, i, n, progress }: { f: (typeof FEATURES)[number]; i: number; n: number; progress: MotionValue<number> }) {
  const scale = useTransform(progress, [i / n, 1], [1, 1 - (n - 1 - i) * 0.04]);
  const dim = useTransform(progress, [i / n, (i + 1) / n], [0, (n - 1 - i) ? 0.35 : 0]);
  return (
    <div className="sticky h-[78vh] pt-2" style={{ top: `calc(10vh + ${i * 22}px)` }}>
      <motion.div
        style={{ scale }}
        onPointerMove={spot}
        className={cn(
          "group relative grid h-[min(64vh,540px)] origin-top overflow-hidden rounded-[2rem] border p-8 shadow-lift sm:p-12 md:grid-cols-2 md:gap-12",
          f.dark ? "border-ink-border bg-ink text-ink-foreground" : "border-border bg-card",
        )}
      >
        <div className="pointer-events-none absolute inset-0 spotlight opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="relative flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <span className={cn("grid h-11 w-11 place-items-center rounded-xl", f.dark ? "bg-ink-foreground text-ink" : "bg-ink text-ink-foreground")}>
              <f.icon className="h-5 w-5" />
            </span>
            <span className={cn("eyebrow", f.dark ? "text-ink-muted" : "text-muted-foreground")}>0{i + 1} · {f.eyebrow}</span>
          </div>
          <div>
            <h3 className="display text-4xl sm:text-6xl">{f.title}</h3>
            <p className={cn("mt-4 max-w-md text-lg", f.dark ? "text-ink-muted" : "text-muted-foreground")}>{f.body}</p>
          </div>
        </div>
        <div className="relative hidden items-center justify-center md:flex">{f.visual}</div>
        <motion.div style={{ opacity: dim }} className="pointer-events-none absolute inset-0 bg-foreground" />
      </motion.div>
    </div>
  );
}

export function Features() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  return (
    <section id="features" className="scroll-mt-20 px-4 pt-28 sm:px-8">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="eyebrow text-rose">Features</p>
        <h2 className="display mt-4 text-5xl text-balance sm:text-7xl">Built for how India actually talks.</h2>
      </Reveal>
      <div ref={ref} className="mx-auto mt-16 max-w-7xl 2xl:max-w-[1600px] pb-[10vh]">
        {FEATURES.map((f, i) => (
          <FeatureCard key={f.title} f={f} i={i} n={FEATURES.length} progress={scrollYProgress} />
        ))}
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */
const FAQS = [
  ["Is my audio stored?", "No. Audio is streamed to the speech provider for transcription and immediately discarded. Only the text transcript is used to build your plan."],
  ["What can I export?", "A full Markdown PRD (.md download or clipboard), a standalone first prompt for coding agents, and the architecture diagram as Mermaid code or SVG."],
  ["Which AI models does Sutra use?", "Plans and chat refinements are compiled on Groq-hosted open models for speed. Architecture diagrams are synthesised by Gemini. Voice runs on Gnani.ai."],
  ["How fast is it on a slow network?", "Plans usually compile in 2–4 seconds. Voice streams in small chunks, so even 3G connections feel responsive. You can always type instead."],
  ["Does it really understand Hinglish?", "Yes — mixed-script and mid-sentence language switches are first-class. Questions are read back in your selected language."],
];

export function FAQ() {
  return (
    <section id="faq" className="scroll-mt-20 px-5 py-28 sm:px-8 sm:py-36">
      <div className="mx-auto grid max-w-7xl 2xl:max-w-[1720px] gap-12 lg:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <p className="eyebrow text-rose">FAQ</p>
          <h2 className="display mt-4 text-5xl sm:text-6xl">Questions, answered.</h2>
          <p className="mt-5 text-lg text-muted-foreground">Everything about privacy, exports and models.</p>
        </Reveal>
        <Reveal delay={0.1}>
          <Accordion type="single" collapsible className="divide-y divide-border border-y border-border">
            {FAQS.map(([q, a], i) => (
              <AccordionItem key={q} value={`f${i}`} className="border-0">
                <AccordionTrigger className="py-6 text-left text-lg font-medium tracking-tight transition-[padding] hover:pl-2 hover:no-underline">{q}</AccordionTrigger>
                <AccordionContent className="pb-6 text-base leading-relaxed text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Final CTA + Footer ---------------- */
export function FinalCta() {
  return (
    <section className="px-4 pb-10 sm:px-8">
      <Reveal className="relative mx-auto max-w-[1720px] overflow-hidden rounded-[2.5rem] border border-border bg-card px-6 py-28 text-center shadow-lift sm:py-36">
        <ShaderField className="absolute inset-0" count={12} />
        <div className="relative">
          <h2 className="display text-6xl text-balance sm:text-8xl">Say it out loud.</h2>
          <p className="mx-auto mt-5 max-w-md text-lg text-muted-foreground">Your next product spec is one voice note away.</p>
          <div className="mt-14 flex justify-center">
            <Magnetic strength={0.5}>
              <div className="animate-float">
                <VoiceOrb size="lg" listening={false} level={0} onClick={() => window.dispatchEvent(new Event(MIC_EVENT))} label="Start talking" />
              </div>
            </Magnetic>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Tap to start talking</p>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const y = useTransform(scrollYProgress, [0, 1], ["40%", "0%"]);
  return (
    <footer className="overflow-hidden px-5 pt-16 sm:px-8">
      <div className="mx-auto flex max-w-[1720px] flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-muted-foreground">Voice-first specification & architecture engine.</p>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
          <a href="mailto:ankit.cybertron@proton.me" className="flex items-center gap-1 hover:text-foreground">
            Contact <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      <div ref={ref} className="mx-auto mt-10 max-w-[1720px]">
        <motion.p style={{ y }} className="display text-thread text-center text-[26vw] leading-[0.8] select-none">
          sutra
        </motion.p>
      </div>
    </footer>
  );
}
