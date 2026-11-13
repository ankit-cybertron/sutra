import { useCallback, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { SutraProvider, useSutra } from "@/lib/sutra/store";
import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient();

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

export function App() {
  const [ready, setReady] = useState(false);
  const onDone = useCallback(() => setReady(true), []);

  return (
    <QueryClientProvider client={queryClient}>
      <SutraProvider>
        <div className="relative min-h-screen bg-background font-sans text-foreground selection:bg-thread/20 selection:text-thread">
          <Intro onDone={onDone} />
          <Cursor />
          <Nav />
          <Stage ready={ready} />
        </div>
      </SutraProvider>
      <Toaster position="bottom-center" />
    </QueryClientProvider>
  );
}

export default App;
