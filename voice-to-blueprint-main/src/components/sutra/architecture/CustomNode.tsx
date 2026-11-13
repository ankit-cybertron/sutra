import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Boxes,
  Cloud,
  CreditCard,
  Database,
  Layout,
  MessageSquare,
  Server,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import type { ArchCategory, ArchNode } from "./types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Layout,
  Database,
  Server,
  Zap,
  MessageSquare,
  Sparkles,
  CreditCard,
  Cloud,
  Workflow,
  Boxes,
};

const CATEGORY_STYLES: Record<
  ArchCategory,
  {
    badge: string;
    iconBox: string;
    borderAccent: string;
    label: string;
  }
> = {
  client: {
    badge: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    iconBox: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    borderAccent: "hover:border-indigo-500/50",
    label: "Client / Presentation",
  },
  api: {
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    iconBox: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    borderAccent: "hover:border-emerald-500/50",
    label: "API & Gateway",
  },
  service: {
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    iconBox: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    borderAccent: "hover:border-sky-500/50",
    label: "Core Service",
  },
  database: {
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    iconBox: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    borderAccent: "hover:border-amber-500/50",
    label: "Database & Storage",
  },
  external: {
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    iconBox: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    borderAccent: "hover:border-rose-500/50",
    label: "External Integration",
  },
  infra: {
    badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    iconBox: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    borderAccent: "hover:border-slate-500/50",
    label: "Infrastructure",
  },
};

export const CustomNode = memo(function CustomNode({
  data,
  selected,
}: NodeProps<ArchNode>) {
  const IconComponent = ICONS[data.iconName] || Boxes;
  const style = CATEGORY_STYLES[data.category] || CATEGORY_STYLES.service;

  const isDimmed = data.isDimmed;
  const isHighlighted = data.isHighlighted;

  return (
    <div
      className={cn(
        "group relative w-[290px] rounded-2xl border bg-card p-4 text-left shadow-soft transition-all duration-200 select-none",
        "border-border/80 hover:shadow-lift",
        style.borderAccent,
        selected && "border-primary ring-2 ring-primary/30 shadow-glow",
        isHighlighted && !selected && "border-primary/80 ring-1 ring-primary/20",
        isDimmed && "opacity-25 grayscale-[0.5] scale-[0.98]",
      )}
    >
      {/* Invisible connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground transition-colors group-hover:!bg-primary"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground transition-colors group-hover:!bg-primary"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground transition-colors group-hover:!bg-primary"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground transition-colors group-hover:!bg-primary"
      />

      {/* Header: Icon + Category Badge */}
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl border shadow-xs transition-transform group-hover:scale-105",
            style.iconBox,
          )}
        >
          <IconComponent className="h-4.5 w-4.5" />
        </div>

        <div className="flex items-center gap-1.5 overflow-hidden">
          {data.techBadge && (
            <span className="truncate rounded-md border border-border/80 bg-secondary px-2 py-0.5 font-mono text-[10px] font-medium text-foreground/80">
              {data.techBadge}
            </span>
          )}
          <span
            className={cn(
              "truncate rounded-full border px-2 py-0.5 text-[10px] font-medium",
              style.badge,
            )}
          >
            {data.category.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Title & Description */}
      <div className="mt-3">
        <h4 className="font-semibold text-[13.5px] leading-tight text-foreground tracking-tight group-hover:text-primary transition-colors">
          {data.name}
        </h4>
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
          {data.description}
        </p>
      </div>

      {/* Layer tag footer */}
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[10.5px] text-muted-foreground">
        <span className="truncate font-mono">{data.layer}</span>
        <span className="shrink-0 text-[10px] font-mono opacity-80">
          {data.inboundCount > 0 ? `↓${data.inboundCount}` : ""}{" "}
          {data.outboundCount > 0 ? `↑${data.outboundCount}` : ""}
        </span>
      </div>
    </div>
  );
});
