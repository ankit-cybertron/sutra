import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type EdgeMouseHandler,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Copy,
  Download,
  Layers,
  LayoutGrid,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomNode } from "./CustomNode";
import { NodeDetailsDrawer } from "./NodeDetailsDrawer";
import type { ArchEdge, ArchGraph, ArchNode } from "./types";
import { cn } from "@/lib/utils";

const nodeTypes = {
  archNode: CustomNode,
};

interface FlowDiagramProps {
  initialGraph: ArchGraph;
  mermaidCode?: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

function InnerFlowDiagram({
  initialGraph,
  mermaidCode,
  onRegenerate,
  isRegenerating = false,
}: FlowDiagramProps) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync state if new graph is provided
  useEffect(() => {
    setNodes(initialGraph.nodes);
    setEdges(initialGraph.edges);
    setSelectedNodeId(null);
    setTimeout(() => {
      fitView({ padding: 0.25, duration: 400 });
    }, 100);
  }, [initialGraph, fitView, setNodes, setEdges]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Interactive selection and highlight logic
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      setSelectedNodeId(node.id);

      const connectedEdges = edges.filter(
        (e) => e.source === node.id || e.target === node.id,
      );
      const connectedNodeIds = new Set<string>([
        node.id,
        ...connectedEdges.map((e) => (e.source === node.id ? e.target : e.source)),
      ]);

      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isSelected: n.id === node.id,
            isHighlighted: connectedNodeIds.has(n.id),
            isDimmed: !connectedNodeIds.has(n.id),
          },
        })),
      );

      setEdges((eds) =>
        eds.map((e) => {
          const isConn = e.source === node.id || e.target === node.id;
          return {
            ...e,
            animated: isConn,
            style: {
              ...e.style,
              stroke: isConn ? "var(--primary, #6366F1)" : "var(--muted-foreground, #94A3B8)",
              strokeWidth: isConn ? 3 : 1.5,
              opacity: isConn ? 1 : 0.25,
            },
          };
        }),
      );
    },
    [edges, setEdges, setNodes],
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSelected: false,
          isHighlighted: false,
          isDimmed: false,
        },
      })),
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        animated: e.data?.label ? true : false,
        style: {
          ...e.style,
          stroke: "var(--muted-foreground, #94A3B8)",
          strokeWidth: 2,
          opacity: 0.85,
        },
      })),
    );
  }, [setEdges, setNodes]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  // SVG Export function
  const exportSvg = useCallback(() => {
    const flowContainer = document.querySelector(".react-flow__viewport") as HTMLElement;
    if (!flowContainer) {
      toast.error("Could not capture diagram viewport");
      return;
    }

    try {
      // Serialize React Flow SVG layer
      const svgElements = document.querySelectorAll(".react-flow__edges svg");
      let allEdgesSvg = "";
      svgElements.forEach((svg) => {
        allEdgesSvg += svg.innerHTML;
      });

      const bbox = flowContainer.getBoundingClientRect();
      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${bbox.width}" height="${bbox.height}" viewBox="0 0 ${bbox.width} ${bbox.height}">
          <style>
            text { font-family: sans-serif; font-size: 12px; fill: #0f172a; }
            path { stroke-linecap: round; }
          </style>
          <g transform="translate(40, 40)">
            ${allEdgesSvg}
          </g>
        </svg>
      `;

      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sutra-architecture-${Date.now()}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Architecture diagram exported as SVG");
    } catch (e) {
      toast.error("Export failed", { description: (e as Error).message });
    }
  }, []);

  const copyMermaid = useCallback(() => {
    if (!mermaidCode) return;
    void navigator.clipboard.writeText(mermaidCode);
    toast.success("Mermaid syntax copied to clipboard");
  }, [mermaidCode]);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden transition-all duration-300 flex flex-col",
        isFullscreen
          ? "fixed inset-0 z-50 bg-background p-6"
          : "h-[620px] rounded-3xl border border-border bg-card shadow-soft",
      )}
    >
      {/* Top Header / Action Toolbar */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
            <LayoutGrid className="h-3.5 w-3.5 text-primary" />
            Interactive Architecture
          </span>
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
            {nodes.length} components · {edges.length} connections
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Controls */}
          <Button
            variant="ghost"
            size="iconSm"
            aria-label="Zoom out"
            onClick={() => zoomOut({ duration: 300 })}
          >
            <ZoomOut />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            aria-label="Zoom in"
            onClick={() => zoomIn({ duration: 300 })}
          >
            <ZoomIn />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fitView({ padding: 0.25, duration: 400 })}
            className="text-xs font-medium"
          >
            Fit view
          </Button>

          <div className="mx-1 h-4 w-px bg-border" />

          {/* MiniMap Toggle */}
          <Button
            variant={showMiniMap ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowMiniMap((s) => !s)}
            className="text-xs"
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Mini-map</span>
          </Button>

          {/* Export & Actions */}
          {mermaidCode && (
            <Button variant="ghost" size="sm" onClick={copyMermaid} className="text-xs">
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mermaid</span>
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={exportSvg} className="text-xs">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">SVG</span>
          </Button>

          {onRegenerate && (
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="Regenerate diagram"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={() => setIsFullscreen((f) => !f)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Main React Flow Canvas */}
      <div className="relative flex-1 w-full min-h-[540px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          maxZoom={2.0}
          defaultEdgeOptions={{
            type: "smoothstep",
          }}
          className="bg-surface/50"
        >
          <Background gap={20} size={1} color="var(--border, #E2E8F0)" />
          {showMiniMap && (
            <MiniMap
              className="!bottom-4 !left-4 !rounded-xl !border !border-border !bg-card/90 !shadow-lift backdrop-blur-md"
              nodeColor={(n) => {
                const cat = (n as ArchNode).data?.category;
                if (cat === "client") return "#6366F1";
                if (cat === "api") return "#10B981";
                if (cat === "service") return "#0EA5E9";
                if (cat === "database") return "#F59E0B";
                if (cat === "external") return "#F43F5E";
                return "#64748B";
              }}
              maskColor="rgba(0, 0, 0, 0.08)"
            />
          )}

          {/* Bottom Category Legend */}
          <Panel position="bottom-left" className="!m-4 hidden sm:block">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card/90 px-3 py-1.5 shadow-soft backdrop-blur-md text-[11px]">
              <span className="font-semibold text-muted-foreground mr-1">Tiers:</span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                Frontend
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                API & Gateway
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                Services
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Database
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                External
              </span>
            </div>
          </Panel>
        </ReactFlow>

        {/* Selected Node Details Drawer */}
        <NodeDetailsDrawer
          node={selectedNode}
          allNodes={nodes}
          edges={edges}
          onClose={() => setSelectedNodeId(null)}
          onSelectNode={(id) => {
            const target = nodes.find((n) => n.id === id);
            if (target) {
              handleNodeClick({} as React.MouseEvent, target);
            }
          }}
        />
      </div>
    </div>
  );
}

export function FlowDiagram(props: FlowDiagramProps) {
  return (
    <ReactFlowProvider>
      <InnerFlowDiagram {...props} />
    </ReactFlowProvider>
  );
}
