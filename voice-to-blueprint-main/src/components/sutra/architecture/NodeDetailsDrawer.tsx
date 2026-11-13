import { motion, AnimatePresence } from "motion/react";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Layers, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ArchEdge, ArchNode } from "./types";
import { cn } from "@/lib/utils";

interface NodeDetailsProps {
  node: ArchNode | null;
  allNodes: ArchNode[];
  edges: ArchEdge[];
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

export function NodeDetailsDrawer({
  node,
  allNodes,
  edges,
  onClose,
  onSelectNode,
}: NodeDetailsProps) {
  if (!node) return null;

  const data = node.data;

  // Find incoming and outgoing edges
  const inEdges = edges.filter((e) => e.target === node.id);
  const outEdges = edges.filter((e) => e.source === node.id);

  const incomingNodes = inEdges
    .map((e) => ({
      edge: e,
      node: allNodes.find((n) => n.id === e.source),
    }))
    .filter((x): x is { edge: ArchEdge; node: ArchNode } => Boolean(x.node));

  const outgoingNodes = outEdges
    .map((e) => ({
      edge: e,
      node: allNodes.find((n) => n.id === e.target),
    }))
    .filter((x): x is { edge: ArchEdge; node: ArchNode } => Boolean(x.node));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 15, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="absolute bottom-4 right-4 z-30 w-84 max-w-[calc(100vw-2rem)] rounded-2xl border border-border/90 bg-card/95 p-4 shadow-lift backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
                {data.category}
              </span>
              {data.techBadge && (
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                  {data.techBadge}
                </span>
              )}
            </div>
            <h3 className="mt-1.5 truncate font-semibold text-base text-foreground">
              {data.name}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {data.description}
            </p>
          </div>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onClose}
            className="shrink-0 rounded-full hover:bg-secondary"
            aria-label="Close details"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Layer Info */}
        <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-border/60 bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-foreground">Tier:</span>
          <span className="truncate font-mono">{data.layer}</span>
        </div>

        {/* Inbound Dependencies */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <ArrowDownRight className="h-3.5 w-3.5 text-indigo-500" />
            <span>Called by ({incomingNodes.length}):</span>
          </div>
          {incomingNodes.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60 italic pl-5">Root entrypoint</p>
          ) : (
            <div className="flex flex-wrap gap-1 pl-4">
              {incomingNodes.map(({ node: inc, edge }) => (
                <button
                  key={inc.id}
                  onClick={() => onSelectNode(inc.id)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-secondary/80 px-2 py-0.5 text-[11px] hover:border-primary/60 transition-colors"
                >
                  <span className="font-medium text-foreground">{inc.data.name}</span>
                  {edge.data?.label && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ({edge.data.label})
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Outbound Dependencies */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
            <span>Connects to ({outgoingNodes.length}):</span>
          </div>
          {outgoingNodes.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60 italic pl-5">Terminal node</p>
          ) : (
            <div className="flex flex-wrap gap-1 pl-4">
              {outgoingNodes.map(({ node: out, edge }) => (
                <button
                  key={out.id}
                  onClick={() => onSelectNode(out.id)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-secondary/80 px-2 py-0.5 text-[11px] hover:border-primary/60 transition-colors"
                >
                  <span className="font-medium text-foreground">{out.data.name}</span>
                  {edge.data?.label && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ({edge.data.label})
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
