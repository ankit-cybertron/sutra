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
  onSubmit: (direct?: boolean) => void;
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
          <span className="h1-main">{t(lang, "h1a")}</span>{" "}
          <span className="h1-accent">{t(lang, "h1b")}</span>
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
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !disabled) onSubmit(true);
            }}
          />
          <div className="idea-foot">
            <VoiceOrb status={voiceStatus} level={voiceLevel} lang={lang} onClick={onOrb} />
            <span className={`count ${over ? "count-over" : ""}`} aria-live="polite">
              {n}/{LIMITS.idea}
            </span>
          </div>
        </div>

        <div className="hero-samples" aria-label="Sample ideas">
          <span className="sample-label">
            {lang === "hi" ? "नमूना विचार:" : lang === "hinglish" ? "Try a sample:" : "Try a sample:"}
          </span>
          <div className="sample-chips">
            <button
              type="button"
              className="sample-chip"
              onClick={() => onIdea("Doctor clinic slot booking and patient reminders on WhatsApp")}
            >
              Clinic slots
            </button>
            <button
              type="button"
              className="sample-chip"
              onClick={() => onIdea("Automated test failure triage and flaky test detector for CI/CD")}
            >
              Test triage
            </button>
            <button
              type="button"
              className="sample-chip"
              onClick={() => onIdea("Hyperlocal kirana grocery delivery with real-time merchant inventory")}
            >
              Kirana delivery
            </button>
            <button
              type="button"
              className="sample-chip"
              onClick={() => onIdea("Freelance developer invoice tracker with automated payment reminders")}
            >
              Freelance invoices
            </button>
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

        <div className="hero-actions">
          <button type="button" className="btn btn-cta" disabled={disabled} onClick={() => onSubmit(true)}>
            {busy ? t(lang, "ctaBusyDirect") : t(lang, "ctaDirect")}
            {!busy && <IconArrow size={18} />}
          </button>
          <button type="button" className="btn btn-light btn-sub-action" disabled={disabled} onClick={() => onSubmit(false)}>
            {busy ? t(lang, "ctaBusy") : t(lang, "ctaClarify")}
          </button>
        </div>

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
