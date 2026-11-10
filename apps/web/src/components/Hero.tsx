import type { ReactNode } from "react";
import type { Lang } from "../api/types";
import { LIMITS } from "../lib/config";
import { t } from "../lib/i18n";
import { countChars } from "../lib/sanitize";
import type { VoiceStatus } from "../voice/useVoice";
import { IconArrow, IconCheck } from "./Icons";
import { VoiceOrb } from "./VoiceOrb";

interface Props {
  lang: Lang;
  idea: string;
  partial: string;
  busy: boolean;
  rateLimited: boolean;
  voiceStatus: VoiceStatus;
  voiceLevel: number;
  onIdea: (v: string) => void;
  onSubmit: () => void;
  onOrb: () => void;
  gate: ReactNode;
  notice: ReactNode;
}

export function Hero({ lang, idea, partial, busy, rateLimited, voiceStatus, voiceLevel, onIdea, onSubmit, onOrb, gate, notice }: Props) {
  const displayIdea = partial ? (idea ? `${idea} ${partial}` : partial) : idea;
  const n = countChars(displayIdea);
  const over = n > LIMITS.idea;
  const disabled = busy || rateLimited || !displayIdea.trim() || over;

  return (
    <section className="hero" id="top">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-inner">
        <h1 className="h1">
          <span>{t(lang, "h1a")}</span>
          <em>{t(lang, "h1b")}</em>
        </h1>
        <p className="hero-sub">{t(lang, "sub")}</p>
        <p className="hero-aud">{t(lang, "audience")}</p>

        <div className={`idea ${over ? "idea-over" : ""}`}>
          <label htmlFor="idea" className="sr-only">
            {t(lang, "yourIdea")}
          </label>
          <textarea
            id="idea"
            value={displayIdea}
            onChange={(e) => onIdea(e.target.value)}
            placeholder={t(lang, "placeholder")}
            rows={4}
            maxLength={LIMITS.idea * 2}
            spellCheck={false}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !disabled) onSubmit();
            }}
          />
          <div className="idea-foot">
            <VoiceOrb status={voiceStatus} level={voiceLevel} lang={lang} onClick={onOrb} />
            <span className={`count ${over ? "count-over" : ""}`} aria-live="polite">
              {n}/{LIMITS.idea}
            </span>
          </div>
        </div>
        {partial && (
          <p className="partial" aria-live="polite">
            <span className="live-dot" aria-hidden="true" />
            <span className="live-label">Live:</span> {partial}
          </p>
        )}

        {notice}
        {gate}

        <button type="button" className="btn btn-cta" disabled={disabled} onClick={onSubmit}>
          {busy ? t(lang, "ctaBusy") : t(lang, "cta")}
          {!busy && <IconArrow size={18} />}
        </button>

        <ul className="trust">
          {(["trust1", "trust2", "trust3", "trust4"] as const).map((k) => (
            <li key={k}>
              <IconCheck size={14} /> {t(lang, k)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
