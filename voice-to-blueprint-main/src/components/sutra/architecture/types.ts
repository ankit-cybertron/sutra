import type { Node, Edge } from "@xyflow/react";

export type ArchCategory =
  | "client"
  | "api"
  | "service"
  | "database"
  | "external"
  | "infra";

export interface ArchNodeData extends Record<string, unknown> {
  id: string;
  name: string;
  description: string;
  category: ArchCategory;
  layer: string;
  techBadge?: string;
  iconName: string;
  inboundCount: number;
  outboundCount: number;
  isSelected?: boolean;
  isDimmed?: boolean;
  isHighlighted?: boolean;
}

export type ArchNode = Node<ArchNodeData, "archNode">;
export type ArchEdge = Edge<{
  label?: string;
  isDimmed?: boolean;
  isHighlighted?: boolean;
}>;

export interface ArchGraph {
  nodes: ArchNode[];
  edges: ArchEdge[];
  layers: string[];
}
