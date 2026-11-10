import type { Lang } from "../api/types";
import { t, type Key } from "../lib/i18n";
import type { VoiceStatus } from "../voice/useVoice";
import { IconMic } from "./Icons";

const LABEL: Record<VoiceStatus, Key> = {
  off: "vOff",
  "needs-gesture": "vNeedsGesture",
  listening: "vListening",
  hearing: "vHearing",
  processing: "vProcessing",
  speaking: "vSpeaking",
  muted: "vMuted",
  denied: "vDenied",
  unsupported: "vUnsupported",
  error: "vError",
};

interface Props {
  status: VoiceStatus;
  level: number;
  lang: Lang;
  /** Click enables the mic when off, otherwise toggles mute. */
  onClick: () => void;
  size?: "sm" | "lg";
}

// Five bars driven by the mic level. State is always conveyed by text too (never colour alone).
export function VoiceOrb({ status, level, lang, onClick, size = "sm" }: Props) {
  const live = status === "listening" || status === "hearing";
  const amp = status === "hearing" ? Math.max(0.25, Math.min(1, level)) : status === "speaking" ? 0.6 : status === "processing" ? 0.35 : 0.12;
  const label = t(lang, LABEL[status]);
  const disabled = status === "denied" || status === "unsupported";

  return (
    <button
      type="button"
      className={`orb orb-${size} orb-${status}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${t(lang, "vToggle")}. ${label}`}
      aria-pressed={status !== "off" && status !== "muted"}
    >
      <span className="orb-icon" aria-hidden="true">
        {live || status === "speaking" || status === "processing" ? (
          <span className="orb-bars">
            {[0.55, 0.9, 1, 0.8, 0.5].map((m, i) => (
              <i key={i} style={{ height: `${Math.round(4 + amp * m * (size === "lg" ? 22 : 16))}px`, animationDelay: `${i * 90}ms` }} />
            ))}
          </span>
        ) : (
          <IconMic size={size === "lg" ? 18 : 15} />
        )}
      </span>
      <span className="orb-label" role="status" aria-live="polite">
        {label}
      </span>
    </button>
  );
}
