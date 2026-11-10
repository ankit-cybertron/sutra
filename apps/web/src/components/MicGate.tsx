import type { Lang } from "../api/types";
import { t } from "../lib/i18n";
import type { VoiceStatus } from "../voice/useVoice";
import { IconMic } from "./Icons";

interface Props {
  lang: Lang;
  status: VoiceStatus;
  /** True once the user has explicitly chosen text-only for this device. */
  textOnly: boolean;
  onAllow: () => void;
  onTextOnly: () => void;
}

// One-time card. Browsers need a user gesture before the mic and audio output can start,
// so "auto-activated" voice begins with this single click, then re-arms itself on every later visit.
export function MicGate({ lang, status, textOnly, onAllow, onTextOnly }: Props) {
  if (textOnly) return null;
  if (status === "denied") return <p className="gate-note" role="status">{t(lang, "gateDenied")}</p>;
  if (status === "unsupported") return <p className="gate-note" role="status">{t(lang, "gateUnsupported")}</p>;
  if (status !== "off") return null;

  return (
    <div className="gate">
      <div className="gate-icon" aria-hidden="true">
        <IconMic size={20} />
      </div>
      <div className="gate-copy">
        <strong>{t(lang, "gateTitle")}</strong>
        <p>{t(lang, "gateBody")}</p>
      </div>
      <div className="gate-actions">
        <button type="button" className="btn btn-light btn-sm" onClick={onAllow}>
          {t(lang, "gateAllow")}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onTextOnly}>
          {t(lang, "gateText")}
        </button>
      </div>
    </div>
  );
}
