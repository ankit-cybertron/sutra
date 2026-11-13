import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <defs>
        <linearGradient id="sutra-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--saffron)" />
          <stop offset="0.5" stopColor="var(--rose)" />
          <stop offset="1" stopColor="var(--cobalt)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="var(--ink)" />
      <path
        d="M7 19c3-7 6 4 9-3s6 4 9-3"
        fill="none"
        stroke="url(#sutra-g)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="25" cy="13" r="1.8" fill="var(--cobalt)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center select-none", className)}>
      <span className="text-[20px] font-bold tracking-tight text-foreground">Sutra</span>
    </span>
  );
}
