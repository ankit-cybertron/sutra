import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ClarifyPanel } from "@/components/sutra/ClarifyPanel";
import { StoryScroll } from "@/components/sutra/StoryScroll";
import { Cursor } from "@/components/sutra/motion/Cursor";
import { Intro } from "@/components/sutra/motion/Intro";
import { GeneratingPanel } from "@/components/sutra/GeneratingPanel";
import { Hero } from "@/components/sutra/Hero";
import { Nav } from "@/components/sutra/Nav";
import { PlanWorkspace } from "@/components/sutra/PlanWorkspace";
import { FAQ, Features, FinalCta, Footer, HorizontalSteps, MarqueeBand } from "@/components/sutra/Sections";
import { useCallback, useState } from "react";
import { SutraProvider, useSutra } from "@/lib/sutra/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sutra — Speak your idea, ship the spec" },
      {
        name: "description",
        content:
          "Voice-first specification engine. Ramble in English, Hindi or Hinglish and get a production-ready PRD, build order and architecture diagram in seconds.",
      },
      { property: "og:title", content: "Sutra — Speak your idea, ship the spec" },
      {
        property: "og:description",
        content: "Turn voice rambles into PRDs, acceptance criteria, build order and architecture diagrams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Stage({ ready }: { ready: boolean }) {
  const { stage } = useSutra();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={stage}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, filter: "blur(6px)" }}
        transition={{ duration: 0.35 }}
      >
        {stage === "idle" && (
          <>
            <Hero ready={ready} />
            <MarqueeBand />
            <StoryScroll />
            <HorizontalSteps />
            <Features />
            <FAQ />
            <FinalCta />
            <Footer />
          </>
        )}
        {stage === "clarifying" && <ClarifyPanel />}
        {stage === "generating" && <GeneratingPanel />}
        {stage === "plan" && <PlanWorkspace />}
      </motion.main>
    </AnimatePresence>
  );
}

function Index() {
  const [ready, setReady] = useState(false);
  const onDone = useCallback(() => setReady(true), []);
  return (
    <SutraProvider>
      <Intro onDone={onDone} />
      <Cursor />
      <Nav />
      <Stage ready={ready} />
    </SutraProvider>
  );
}
