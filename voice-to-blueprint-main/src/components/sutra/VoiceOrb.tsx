import { motion } from "motion/react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  listening: boolean;
  level: number;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
  label?: string;
  speaking?: boolean;
  processing?: boolean;
}

const SIZES = { sm: 44, md: 76, lg: 132 };

export function VoiceOrb({ listening, level, onClick, size = "md", label, speaking, processing }: Props) {
  const px = SIZES[size];
  const scale = listening ? 1 + level * 0.35 : 1;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={listening}
      aria-label={label ?? (listening ? "Stop recording" : "Start recording")}
      className="group relative grid shrink-0 cursor-pointer place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      style={{ width: px, height: px }}
    >
      {/* ripples */}
      {listening && (
        <>
          <span className="absolute inset-0 animate-ripple rounded-full bg-thread opacity-40" />
          <span className="absolute inset-0 animate-ripple rounded-full bg-thread opacity-30 [animation-delay:0.7s]" />
        </>
      )}
      {/* glow */}
      <span
        className={cn(
          "absolute -inset-3 rounded-full bg-thread blur-2xl transition-opacity duration-500 group-hover:opacity-50",
          listening || speaking ? "opacity-60" : "opacity-0",
        )}
      />
      {/* body */}
      <motion.span
        className="absolute inset-0 overflow-hidden rounded-full bg-ink shadow-lift"
        animate={{ scale }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      >
        <span
          className={cn(
            "absolute -inset-1/4 animate-spin-slow rounded-full opacity-90",
            "bg-[conic-gradient(from_0deg,var(--saffron),var(--rose),var(--cobalt),var(--saffron))]",
            !listening && !speaking && !processing && "opacity-70 [animation-duration:24s]",
            processing && "[animation-duration:2s]",
          )}
        />
        <span className="absolute inset-[3px] rounded-full bg-[radial-gradient(circle_at_35%_30%,color-mix(in_oklab,var(--ink-foreground)_28%,transparent),transparent_55%),radial-gradient(circle_at_50%_60%,color-mix(in_oklab,var(--ink)_10%,transparent),color-mix(in_oklab,var(--ink)_55%,transparent))]" />
      </motion.span>
      <span className="relative text-ink-foreground">
        {listening ? (
          <Square className={cn("fill-current", size === "lg" ? "h-8 w-8" : size === "md" ? "h-5 w-5" : "h-3.5 w-3.5")} />
        ) : (
          <Mic className={cn(size === "lg" ? "h-10 w-10" : size === "md" ? "h-6 w-6" : "h-4 w-4")} strokeWidth={1.8} />
        )}
      </span>
    </button>
  );
}

export function Waveform({ level, active, bars = 28 }: { level: number; active: boolean; bars?: number }) {
  return (
    <div className="flex h-8 items-center gap-[3px]" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        const wave = Math.sin((i / bars) * Math.PI);
        const h = active ? 4 + wave * level * 28 * (0.6 + ((i * 37) % 10) / 25) : 4;
        return (
          <motion.span
            key={i}
            className="w-[3px] rounded-full bg-thread"
            animate={{ height: Math.max(4, Math.min(30, h)) }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          />
        );
      })}
    </div>
  );
}
