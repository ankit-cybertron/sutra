import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// Masked per-word rise, Apple keynote style.
export function SplitText({ text, className, delay = 0, play = true, wordClassName }: { text: string; className?: string; delay?: number; play?: boolean; wordClassName?: string }) {
  const words = text.split(" ");
  return (
    <span className={cn("inline-block", className)} aria-label={text}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className="inline-block overflow-hidden pb-[0.12em] align-bottom" aria-hidden>
          <motion.span
            className={cn("inline-block", wordClassName)}
            initial={{ y: "110%", rotate: 4 }}
            animate={play ? { y: "0%", rotate: 0 } : { y: "110%", rotate: 4 }}
            transition={{ duration: 0.9, delay: delay + i * 0.07, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {w}
            {i < words.length - 1 ? "\u00a0" : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
