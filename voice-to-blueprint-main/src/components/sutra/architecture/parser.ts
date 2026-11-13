import type { ArchCategory, ArchEdge, ArchNode } from "./types";

interface ParsedRawNode {
  id: string;
  rawLabel: string;
  shape: "rect" | "cylinder" | "subroutine" | "diamond" | "round";
  layer: string;
}

interface ParsedRawEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style: "solid" | "dashed";
}

function inferCategoryAndMetadata(
  label: string,
  layerName: string,
): {
  name: string;
  description: string;
  category: ArchCategory;
  techBadge?: string;
  iconName: string;
} {
  const clean = label.replace(/[()"[\]{}]/g, "").trim();
  const lower = clean.toLowerCase();
  const layerLower = layerName.toLowerCase();

  let category: ArchCategory = "service";
  let iconName = "Boxes";
  let techBadge: string | undefined = undefined;
  let description = "Core system component";

  // Check layer context first
  if (layerLower.includes("client") || layerLower.includes("presentation") || layerLower.includes("frontend") || layerLower.includes("ui")) {
    category = "client";
  } else if (layerLower.includes("api") || layerLower.includes("gateway") || layerLower.includes("edge")) {
    category = "api";
  } else if (layerLower.includes("data") || layerLower.includes("persist") || layerLower.includes("storage") || layerLower.includes("cache")) {
    category = "database";
  } else if (layerLower.includes("external") || layerLower.includes("integration") || layerLower.includes("third")) {
    category = "external";
  } else if (layerLower.includes("infra") || layerLower.includes("deploy")) {
    category = "infra";
  }

  // Refine category & extract metadata based on node content
  if (lower.includes("react") || lower.includes("spa") || lower.includes("web") || lower.includes("browser") || lower.includes("frontend") || lower.includes("ui") || lower.includes("next")) {
    category = "client";
    iconName = "Layout";
    description = "User interface & client application";
    if (lower.includes("react")) techBadge = "React 19";
    else if (lower.includes("next")) techBadge = "Next.js";
    else if (lower.includes("mobile")) techBadge = "Mobile App";
  } else if (lower.includes("postgres") || lower.includes("pg") || lower.includes("sql") || lower.includes("database") || lower.includes("mongo") || lower.includes("db") || lower.includes("store")) {
    category = "database";
    iconName = "Database";
    description = "Persistent data storage & schemas";
    if (lower.includes("postgres")) techBadge = "PostgreSQL";
    else if (lower.includes("mongo")) techBadge = "MongoDB";
    else if (lower.includes("sqlite")) techBadge = "SQLite";
    else techBadge = "Database";
  } else if (lower.includes("redis") || lower.includes("cache") || lower.includes("lock") || lower.includes("memcache")) {
    category = "database";
    iconName = "Zap";
    description = "In-memory cache & distributed locks";
    techBadge = "Redis";
  } else if (lower.includes("api") || lower.includes("gateway") || lower.includes("fastapi") || lower.includes("express") || lower.includes("router") || lower.includes("server") || lower.includes("backend")) {
    category = "api";
    iconName = "Server";
    description = "REST / WebSocket API routing & auth";
    if (lower.includes("fastapi")) techBadge = "FastAPI";
    else if (lower.includes("express") || lower.includes("node")) techBadge = "Express / Node";
    else techBadge = "API Gateway";
  } else if (lower.includes("whatsapp") || lower.includes("twilio") || lower.includes("meta")) {
    category = "external";
    iconName = "MessageSquare";
    description = "Messaging API & customer communication";
    techBadge = "WhatsApp API";
  } else if (lower.includes("llm") || lower.includes("groq") || lower.includes("gemini") || lower.includes("openai") || lower.includes("ai") || lower.includes("inference")) {
    category = "external";
    iconName = "Sparkles";
    description = "Neural intelligence & model reasoning";
    if (lower.includes("gemini")) techBadge = "Gemini Flash";
    else if (lower.includes("groq")) techBadge = "Groq LPU";
    else techBadge = "AI Model";
  } else if (lower.includes("stripe") || lower.includes("payment") || lower.includes("razorpay") || lower.includes("paypal")) {
    category = "external";
    iconName = "CreditCard";
    description = "Payment processing & checkout webhooks";
    techBadge = "Payment API";
  } else if (lower.includes("docker") || lower.includes("k8s") || lower.includes("kubernetes") || lower.includes("cloud") || lower.includes("aws") || lower.includes("vercel")) {
    category = "infra";
    iconName = "Cloud";
    description = "Cloud hosting & container execution";
    if (lower.includes("docker")) techBadge = "Docker";
    else if (lower.includes("k8s")) techBadge = "Kubernetes";
    else techBadge = "Cloud Infra";
  } else if (lower.includes("worker") || lower.includes("queue") || lower.includes("job") || lower.includes("task") || lower.includes("celery") || lower.includes("cron")) {
    category = "service";
    iconName = "Workflow";
    description = "Background processing & asynchronous jobs";
    techBadge = "Worker Service";
  }

  // Clean up component title
  let name = clean;
  // If label is like `PG[("PostgreSQL Database")]`, clean is `PostgreSQL Database`
  // Strip redundant words if too long
  if (name.length > 28 && name.includes(" - ")) {
    name = name.split(" - ")[0];
  }

  return { name, description, category, techBadge, iconName };
}

/**
 * Parses Mermaid flowchart code into clean React Flow nodes and edges.
 */
export function parseMermaidToGraph(mermaidCode: string): {
  nodes: ArchNode[];
  edges: ArchEdge[];
  layers: string[];
} {
  const lines = mermaidCode.split("\n");
  const rawNodes: Map<string, ParsedRawNode> = new Map();
  const rawEdges: ParsedRawEdge[] = [];
  const layersSet: Set<string> = new Set();

  let currentLayer = "Core Architecture";

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip comments, empty lines, and flowchart directives
    if (!line || line.startsWith("%%") || line.startsWith("flowchart") || line.startsWith("graph")) {
      continue;
    }

    // Subgraph declaration: e.g. `subgraph ClientLayer ["Client & Interaction Tier"]`
    const subgraphMatch = line.match(/^subgraph\s+([A-Za-z0-9_]+)(?:\s*\["([^"]+)"\]|\s*\[([^\]]+)\])?/i);
    if (subgraphMatch) {
      const title = subgraphMatch[2] || subgraphMatch[3] || subgraphMatch[1];
      currentLayer = title.trim();
      layersSet.add(currentLayer);
      continue;
    }

    if (line === "end") {
      currentLayer = "Core Architecture";
      continue;
    }

    // Edge pattern: e.g. `A -->|Label| B` or `A --> B` or `A -.->|Label| B`
    // Matches: source, arrow, optional label, target
    const edgeMatch = line.match(
      /^([A-Za-z0-9_]+)\s*(-->|-\.->|===|==>)\s*(?:\|([^|]+)\||--\s*([^-]+)\s*-->)?\s*([A-Za-z0-9_]+)/,
    );
    if (edgeMatch) {
      const source = edgeMatch[1];
      const arrowType = edgeMatch[2];
      const edgeLabel = (edgeMatch[3] || edgeMatch[4] || "").trim();
      const target = edgeMatch[5];

      rawEdges.push({
        id: `e-${source}-${target}-${rawEdges.length}`,
        source,
        target,
        label: edgeLabel || undefined,
        style: arrowType.includes(".") ? "dashed" : "solid",
      });

      // Ensure nodes exist even if declared inline in the edge
      if (!rawNodes.has(source)) {
        rawNodes.set(source, {
          id: source,
          rawLabel: source,
          shape: "rect",
          layer: currentLayer,
        });
      }
      if (!rawNodes.has(target)) {
        rawNodes.set(target, {
          id: target,
          rawLabel: target,
          shape: "rect",
          layer: currentLayer,
        });
      }
      continue;
    }

    // Node declarations with brackets
    // 1. Cylinder: PG[("PostgreSQL Database")]
    const cylinderMatch = line.match(/^([A-Za-z0-9_]+)\[\("([^"]+)"\)|^\(([^\)]+)\)\]/);
    if (cylinderMatch) {
      const id = cylinderMatch[1];
      const label = cylinderMatch[2] || cylinderMatch[3] || id;
      rawNodes.set(id, { id, rawLabel: label, shape: "cylinder", layer: currentLayer });
      continue;
    }

    // 2. Subroutine / double-bracket: WA[["WhatsApp Business API"]]
    const subMatch = line.match(/^([A-Za-z0-9_]+)\[\["([^"]+)"\]\]|^\[\[([^\]]+)\]\]/);
    if (subMatch) {
      const id = subMatch[1];
      const label = subMatch[2] || subMatch[3] || id;
      rawNodes.set(id, { id, rawLabel: label, shape: "subroutine", layer: currentLayer });
      continue;
    }

    // 3. Rectangular: WebClient["React 19 Responsive SPA"] or ID["Label"]
    const rectMatch = line.match(/^([A-Za-z0-9_]+)\["([^"]+)"\]|^\[([^\]]+)\]/);
    if (rectMatch) {
      const id = rectMatch[1];
      const label = rectMatch[2] || rectMatch[3] || id;
      rawNodes.set(id, { id, rawLabel: label, shape: "rect", layer: currentLayer });
      continue;
    }

    // 4. Round / stadium: ID(["Label"])
    const stadiumMatch = line.match(/^([A-Za-z0-9_]+)\(\["([^"]+)"\]\)/);
    if (stadiumMatch) {
      const id = stadiumMatch[1];
      const label = stadiumMatch[2] || id;
      rawNodes.set(id, { id, rawLabel: label, shape: "round", layer: currentLayer });
      continue;
    }
  }

  // Calculate inbound and outbound counts for each node
  const inDegree: Record<string, number> = {};
  const outDegree: Record<string, number> = {};

  for (const edge of rawEdges) {
    outDegree[edge.source] = (outDegree[edge.source] || 0) + 1;
    inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
  }

  // Convert to React Flow nodes
  const nodes: ArchNode[] = Array.from(rawNodes.values()).map((raw) => {
    const meta = inferCategoryAndMetadata(raw.rawLabel, raw.layer);
    return {
      id: raw.id,
      type: "archNode",
      position: { x: 0, y: 0 },
      data: {
        id: raw.id,
        name: meta.name,
        description: meta.description,
        category: meta.category,
        layer: raw.layer,
        techBadge: meta.techBadge,
        iconName: meta.iconName,
        inboundCount: inDegree[raw.id] || 0,
        outboundCount: outDegree[raw.id] || 0,
      },
    };
  });

  // Convert to React Flow edges with smooth styling
  const edges: ArchEdge[] = rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    animated: e.style === "dashed",
    data: {
      label: e.label,
    },
    label: e.label,
    labelStyle: {
      fill: "var(--foreground, #0F172A)",
      fontSize: 11,
      fontFamily: "Geist, sans-serif",
      fontWeight: 500,
    },
    labelBgStyle: {
      fill: "var(--card, #FFFFFF)",
      fillOpacity: 0.95,
      stroke: "var(--border, #E2E8F0)",
      strokeWidth: 1,
      rx: 6,
      ry: 6,
    },
    labelBgPadding: [6, 4] as [number, number],
    style: {
      stroke: e.style === "dashed" ? "var(--accent, #6366F1)" : "var(--muted-foreground, #94A3B8)",
      strokeWidth: 2,
      strokeDasharray: e.style === "dashed" ? "5,5" : undefined,
    },
  }));

  const layers = Array.from(layersSet);
  if (layers.length === 0) layers.push("Core Architecture");

  return { nodes, edges, layers };
}
