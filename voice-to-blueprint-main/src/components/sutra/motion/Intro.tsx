import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LogoMark } from "../Logo";

// Short brand intro: counter + curtain lift. Calls onDone when the page should start animating.
export function Intro({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0);
  const [show, setShow] = useState(true);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1100);
      setN(Math.round((1 - Math.pow(1 - p, 3)) * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
      else
        setTimeout(() => {
          setShow(false);
          onDone();
        }, 150);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[90] flex flex-col justify-between bg-ink p-8 text-ink-foreground sm:p-12"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          initial={{ clipPath: "inset(0 0 0% 0)" }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight">Sutra</span>
          </div>
          <div className="flex items-end justify-between gap-6">
            <p className="max-w-xs text-sm text-ink-muted">Tuning the threads between your voice and your codebase…</p>
            <span className="display font-mono text-[22vw] leading-none tabular-nums sm:text-[14vw]">
              {n}
              <span className="text-thread">%</span>
            </span>
          </div>
          <motion.div className="absolute bottom-0 left-0 h-1 bg-thread" style={{ width: `${n}%` }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
