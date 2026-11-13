import { motion } from "motion/react";
import { useSutra } from "@/lib/sutra/store";
import { ChatPanel } from "./ChatPanel";
import { PlanCard } from "./PlanCard";

export function PlanWorkspace() {
  const { doc } = useSutra();
  if (!doc) return null;

  return (
    <section className="mx-auto w-full max-w-[1720px] px-4 pt-24 pb-16 sm:px-6 lg:px-8 xl:px-12">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1.35fr)_460px] 2xl:grid-cols-[minmax(0,1.45fr)_480px]">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
          className="min-w-0 flex-1"
        >
          <PlanCard doc={doc} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }}
          className="h-[640px] lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)] lg:self-start"
        >
          <ChatPanel />
        </motion.div>
      </div>
    </section>
  );
}
