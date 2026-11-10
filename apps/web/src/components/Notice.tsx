import type { Lang } from "../api/types";
import { t } from "../lib/i18n";
import { useCountdown } from "../hooks/useCountdown";
import { IconClose } from "./Icons";

export type NoticeKind = "rate" | "blocked" | "long" | "invalid" | "provider" | "voice" | "network" | "notfound" | "generic";

export interface NoticeState {
  kind: NoticeKind;
  /** Epoch ms when a rate limit ends. */
  until?: number;
}

interface Props {
  notice: NoticeState;
  lang: Lang;
  onDismiss: () => void;
}

export function Notice({ notice, lang, onDismiss }: Props) {
  const left = useCountdown(notice.kind === "rate" ? (notice.until ?? null) : null);

  let text: string;
  switch (notice.kind) {
    case "rate":
      text = left > 0 ? t(lang, "eRate", { s: left }) : t(lang, "eRateNow");
      break;
    case "blocked":
      text = t(lang, "eBlocked");
      break;
    case "long":
      text = t(lang, "eLong");
      break;
    case "invalid":
      text = t(lang, "eInvalid");
      break;
    case "provider":
      text = t(lang, "eProvider");
      break;
    case "voice":
      text = t(lang, "eVoice");
      break;
    case "network":
      text = t(lang, "eNetwork");
      break;
    case "notfound":
      text = t(lang, "eNotFound");
      break;
    default:
      text = t(lang, "eGeneric");
  }

  const tone = notice.kind === "rate" || notice.kind === "voice" ? "warn" : "danger";
  return (
    <div className={`notice notice-${tone}`} role="alert">
      <span>{text}</span>
      <button type="button" className="icon-btn" onClick={onDismiss} aria-label={t(lang, "dismiss")}>
        <IconClose size={16} />
      </button>
    </div>
  );
}

/** True while a rate-limit notice is still counting down. Used to disable submit buttons. */
export function isRateLimited(notice: NoticeState | null, now = Date.now()): boolean {
  return !!notice && notice.kind === "rate" && !!notice.until && notice.until > now;
}
