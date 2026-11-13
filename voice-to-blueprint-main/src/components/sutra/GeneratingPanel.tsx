import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceOrb } from "./VoiceOrb";

const STEPS = [
  "Parsing core requirements and user stories",
  "Defining acceptance criteria and edge cases",
  "Sequencing engineering build order",
  "Generating prompt-ready launch instructions",
];

export function GeneratingPanel() {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDone((d) => Math.min(STEPS.length - 1, d + 1)), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="relative grid min-h-screen place-items-center px-5 pt-16">
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow rounded-full bg-thread-soft blur-3xl" />
      <div className="relative w-full max-w-lg text-center">
        <div className="flex justify-center">
          <VoiceOrb size="lg" listening={false} processing level={0} onClick={() => {}} label="Compiling" />
        </div>
        <h1 className="display mt-10 text-4xl sm:text-5xl">
          <span className="shimmer-text">Compiling your blueprint</span>
        </h1>
        <p className="mt-3 text-muted-foreground">This usually takes 2–4 seconds.</p>

        <ul className="mt-10 space-y-2 text-left">
          {STEPS.map((s, i) => {
            const state = i < done ? "done" : i === done ? "active" : "todo";
            return (
              <motion.li
                key={s}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: state === "todo" ? 0.45 : 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-[15px] transition-all duration-500",
                  state === "active" ? "border-border bg-card shadow-lift" : "border-transparent",
                )}
              >
                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors", state === "done" ? "bg-thread text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                  {state === "done" ? <Check className="h-3.5 w-3.5" /> : state === "active" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                {s}
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
