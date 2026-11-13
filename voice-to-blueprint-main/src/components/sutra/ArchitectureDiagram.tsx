import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Network, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/sutra/api";
import { planToMarkdown } from "@/lib/sutra/markdown";
import type { PlanDoc } from "@/lib/sutra/types";
import { FlowDiagram } from "./architecture/FlowDiagram";
import { getLayoutedGraph } from "./architecture/layout";
import { parseMermaidToGraph } from "./architecture/parser";
import type { ArchGraph } from "./architecture/types";

export function ArchitectureDiagram({ doc }: { doc: PlanDoc }) {
  const [graph, setGraph] = useState<ArchGraph | null>(null);
  const [mermaidCode, setMermaidCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelNotice, setModelNotice] = useState<string | null>(null);

  // A new plan version invalidates the old diagram
  useEffect(() => {
    setGraph(null);
    setMermaidCode(null);
    setModelNotice(null);
  }, [doc.id]);

  async function generate() {
    setLoading(true);
    try {
      const r = await api.generateArchitectureDiagram(doc.id, planToMarkdown(doc));
      const code = r.mermaid || r.fallbackMermaid;
      if (!code) throw new Error("No architecture code returned");

      setMermaidCode(code);
      if (r.model) {
        setModelNotice(r.model === "gemini-2.5-flash" ? "Synthesized with Gemini 2.5 Flash" : r.model);
      }

      // Parse Mermaid syntax into rich nodes & edges
      const rawGraph = parseMermaidToGraph(code);

      // Compute intelligent layered positioning using ELK.js
      const layouted = await getLayoutedGraph(rawGraph.nodes, rawGraph.edges, "DOWN");

      setGraph(layouted);
      toast.success("Interactive architecture diagram generated!");
    } catch (e) {
      toast.error("Diagram generation failed", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!graph ? (
          <motion.div
            key="empty"
            exit={{ opacity: 0 }}
            className="grid place-items-center gap-5 rounded-3xl border border-border bg-surface-2 px-6 py-16 text-center grid-dots"
          >
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-card shadow-soft border border-border/80">
              {loading ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : (
                <Network className="h-7 w-7 text-indigo-500" />
              )}
            </span>
            <div className="max-w-md">
              <h3 className="font-semibold text-lg text-foreground">
                {loading ? "Synthesising multi-tier architecture…" : "Interactive System Architecture"}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                Transform this specification into an interactive, multi-tier React Flow diagram with component details, dependency tracking, and live connections.
              </p>
            </div>
            <Button
              variant="hero"
              size="lg"
              onClick={generate}
              disabled={loading}
              className="mt-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Generate architecture diagram
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="diagram"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-2"
          >
            <FlowDiagram
              initialGraph={graph}
              mermaidCode={mermaidCode ?? undefined}
              onRegenerate={generate}
              isRegenerating={loading}
            />
            {modelNotice && (
              <p className="px-2 text-right font-mono text-[11px] text-muted-foreground">
                {modelNotice}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
