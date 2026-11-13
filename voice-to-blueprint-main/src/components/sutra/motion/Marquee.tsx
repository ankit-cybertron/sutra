import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Marquee({ children, duration = 40, reverse, className }: { children: ReactNode; duration?: number; reverse?: boolean; className?: string }) {
  return (
    <div className={cn("group relative flex overflow-hidden mask-fade-x", className)}>
      <div
        className={cn("flex w-max shrink-0 animate-marquee items-center group-hover:[animation-play-state:paused]", reverse && "[animation-direction:reverse]")}
        style={{ ["--marquee-duration" as string]: `${duration}s` }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>{children}</div>
      </div>
    </div>
  );
}
