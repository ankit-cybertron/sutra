import ELK from "elkjs/lib/elk.bundled.js";
import type { ArchEdge, ArchGraph, ArchNode } from "./types";

const elk = new ELK();

const NODE_WIDTH = 290;
const NODE_HEIGHT = 115;

/**
 * Calculates non-overlapping, layered positions for architecture nodes using ELK.js.
 */
export async function getLayoutedGraph(
  nodes: ArchNode[],
  edges: ArchEdge[],
  direction: "DOWN" | "RIGHT" = "DOWN",
): Promise<ArchGraph> {
  if (nodes.length === 0) {
    return { nodes: [], edges: [], layers: [] };
  }

  const elkNodes = nodes.map((n) => ({
    id: n.id,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  }));

  const elkEdges = edges.map((e) => ({
    id: e.id,
    sources: [e.source],
    targets: [e.target],
  }));

  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.spacing.nodeNode": "50",
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
      "elk.layered.spacing.edgeNodeBetweenLayers": "35",
      "elk.spacing.edgeEdge": "25",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.edgeRouting": "ORTHOGONAL",
    },
    children: elkNodes,
    edges: elkEdges,
  };

  try {
    const layouted = await elk.layout(graph);

    const positionMap = new Map<string, { x: number; y: number }>();
    if (layouted.children) {
      for (const c of layouted.children) {
        if (c.id && c.x !== undefined && c.y !== undefined) {
          positionMap.set(c.id, { x: c.x, y: c.y });
        }
      }
    }

    const positionedNodes: ArchNode[] = nodes.map((node) => {
      const pos = positionMap.get(node.id) || { x: 0, y: 0 };
      return {
        ...node,
        position: pos,
      };
    });

    // Extract unique layers
    const layers = Array.from(new Set(nodes.map((n) => n.data.layer)));

    return {
      nodes: positionedNodes,
      edges,
      layers,
    };
  } catch (error) {
    console.error("ELK layout failed, falling back to simple grid:", error);

    // Fallback: simple deterministic grid
    const positionedNodes = nodes.map((node, i) => ({
      ...node,
      position: {
        x: (i % 3) * (NODE_WIDTH + 60) + 40,
        y: Math.floor(i / 3) * (NODE_HEIGHT + 80) + 40,
      },
    }));

    return {
      nodes: positionedNodes,
      edges,
      layers: Array.from(new Set(nodes.map((n) => n.data.layer))),
    };
  }
}
