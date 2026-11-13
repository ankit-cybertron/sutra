import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { Check, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const RAMBLE =
  "Mujhe ek app chahiye for my clinic — patients WhatsApp pe slot book kar sakein, reminder mile ek ghanta pehle, aur doctor ko din ka schedule dikhe. Payment abhi nahi, bas reserve.";
const KEYWORDS = /^(WhatsApp|slot|book|reminder|ghanta|schedule|reserve\.?|clinic)$/i;

const FEATURES = [
  { label: "WhatsApp slot booking", at: 0.58 },
  { label: "Reminder 1 hour before", at: 0.64 },
  { label: "Doctor's day schedule", at: 0.7 },
  { label: "Reserve-only — payments later", at: 0.76 },
];

function Word({ w, i, n, progress }: { w: string; i: number; n: number; progress: MotionValue<number> }) {
  const start = 0.04 + (i / n) * 0.46;
  const opacity = useTransform(progress, [start, start + 0.03], [0.14, 1]);
  const key = KEYWORDS.test(w.replace(/[,—]/g, ""));
  return (
    <motion.span style={{ opacity }} className={cn("inline-block", key && "text-thread")}>
      {w}&nbsp;
    </motion.span>
  );
}

function FeatureRow({ label, at, progress }: { label: string; at: number; progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [at, at + 0.04], [0, 1]);
  const x = useTransform(progress, [at, at + 0.04], [-24, 0]);
  return (
    <motion.div style={{ opacity, x }} className="flex items-center gap-3 rounded-xl bg-ink-foreground/[0.05] px-3 py-2.5 text-sm text-ink-foreground">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-thread">
        <Check className="h-3 w-3" />
      </span>
      {label}
    </motion.div>
  );
}

export function StoryScroll() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const { scrollYProgress: enter } = useScroll({ target: ref, offset: ["start end", "start start"] });
  const scale = useTransform(enter, [0, 1], [0.88, 1]);
  const radius = useTransform(enter, [0, 1], [48, 0]);
  const words = RAMBLE.split(" ");

  const cardOpacity = useTransform(scrollYProgress, [0.48, 0.56], [0, 1]);
  const cardY = useTransform(scrollYProgress, [0.48, 0.56], [60, 0]);
  const cardRotate = useTransform(scrollYProgress, [0.48, 0.6], [-6, 0]);
  const orbScale = useTransform(scrollYProgress, [0, 0.5, 0.56], [1, 1, 0.6]);
  const bar = useTransform(scrollYProgress, [0, 0.95], ["0%", "100%"]);

  const [score, setScore] = useState(0);
  const [stage, setStage] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setScore(Math.round(Math.max(0, Math.min(1, (v - 0.56) / 0.3)) * 94));
    setStage(v < 0.5 ? 0 : v < 0.56 ? 1 : 2);
  });

  return (
    <section id="demo" ref={ref} className="relative h-[360vh] scroll-mt-0">
      <motion.div style={{ scale, borderRadius: radius }} className="sticky top-0 flex h-screen origin-top flex-col overflow-hidden bg-ink">
        <div className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-thread opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[420px] w-[420px] rounded-full bg-cobalt opacity-20 blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-[1720px] flex-1 items-center gap-12 px-6 pt-24 sm:px-12 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="mb-8 flex items-center gap-4">
              <motion.span style={{ scale: orbScale }} className="relative grid h-14 w-14 place-items-center rounded-full bg-thread">
                {stage === 0 && <span className="absolute inset-0 animate-ripple rounded-full bg-thread" />}
                <Mic className="relative h-6 w-6 text-ink-foreground" />
              </motion.span>
              <div>
                <p className="eyebrow text-saffron">Live voice note</p>
                <p className="font-mono text-xs text-ink-muted">Hinglish · 14s · scroll to transcribe</p>
              </div>
            </div>
            <p className="text-[clamp(1.6rem,3.4vw,3rem)] leading-[1.15] font-medium tracking-tight text-ink-foreground">
              {words.map((w, i) => (
                <Word key={i} w={w} i={i} n={words.length} progress={scrollYProgress} />
              ))}
            </p>
          </div>

          <motion.div style={{ opacity: cardOpacity, y: cardY, rotate: cardRotate }} className="rounded-3xl border border-ink-border bg-ink-foreground/[0.04] p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-ink-muted">SUTRA-9F8 · v1</span>
              <span className="rounded-full bg-success/20 px-2.5 py-1 font-mono text-xs text-success tabular-nums">{score}/100 ready</span>
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-ink-foreground">Clinic Slots on WhatsApp</p>
            <p className="mt-1 text-sm text-ink-muted">Book, remind and run a doctor's day without a front-desk.</p>
            <div className="mt-5 grid gap-2">
              {FEATURES.map((f) => (
                <FeatureRow key={f.label} {...f} progress={scrollYProgress} />
              ))}
            </div>
          </motion.div>
        </div>

        <div className="relative mx-auto w-full max-w-[1720px] px-6 pb-10 sm:px-12">
          <div className="flex items-center gap-6 font-mono text-xs">
            {["01 Ramble", "02 Clarify", "03 Blueprint"].map((s, i) => (
              <span key={s} className={cn("transition-colors duration-300", stage >= i ? "text-ink-foreground" : "text-ink-muted/50")}>
                {s}
              </span>
            ))}
          </div>
          <div className="mt-3 h-[2px] overflow-hidden rounded-full bg-ink-foreground/10">
            <motion.div style={{ width: bar }} className="h-full bg-thread" />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
