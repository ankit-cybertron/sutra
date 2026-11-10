import type { ReactNode } from "react";
import type { Lang, Question } from "../api/types";
import { LIMITS } from "../lib/config";
import { t } from "../lib/i18n";
import { countChars } from "../lib/sanitize";
import type { VoiceStatus } from "../voice/useVoice";
import { IconArrow } from "./Icons";
import { VoiceOrb } from "./VoiceOrb";

interface Props {
  lang: Lang;
  idea: string;
  questions: Question[];
  index: number;
  draft: string;
  partial: string;
  rateLimited: boolean;
  busy: boolean;
  voiceStatus: VoiceStatus;
  voiceLevel: number;
  onDraft: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
  onPlanNow: () => void;
  onOrb: () => void;
  notice: ReactNode;
}

export function ClarifyPanel(p: Props) {
  const q = p.questions[p.index];
  if (!q) return null;
  const total = p.questions.length;
  const last = p.index === total - 1;
  const displayDraft = p.partial ? (p.draft ? `${p.draft} ${p.partial}` : p.partial) : p.draft;
  const n = countChars(displayDraft);
  const over = n > LIMITS.answer;

  return (
    <section className="work work-clarify" aria-labelledby="q-title">
      <div className="work-col">
        <div className="card">
          <div className="card-label">{t(p.lang, "yourIdea")}</div>
          <p className="card-body idea-recap">{p.idea}</p>
        </div>
        <div className="dots" aria-hidden="true">
          {p.questions.map((_, i) => (
            <span key={i} className={i === p.index ? "on" : i < p.index ? "done" : ""} />
          ))}
        </div>
      </div>

      <div className="work-col">
        <div className="card card-strong">
          <div className="card-label">{t(p.lang, "questionOf", { n: p.index + 1, total })}</div>
          <h2 id="q-title" className="q-title" lang={p.lang === "hi" ? "hi" : undefined}>
            {q.displayText}
          </h2>

          {q.options.length > 0 && (
            <div className="chips-wrap">
              <span className="chips-subtle-hint">Quick suggestions (or type / speak freely below):</span>
              <div className="chips" role="group" aria-label="Quick answers">
                {q.options.map((o) => (
                  <button key={o} type="button" className="chip" onClick={() => p.onDraft(o)}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label htmlFor="answer" className="sr-only">
            {q.displayText}
          </label>
          <div className="idea idea-compact">
            <textarea
              id="answer"
              value={displayDraft}
              onChange={(e) => p.onDraft(e.target.value)}
              placeholder={t(p.lang, "answerPlaceholder")}
              rows={3}
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!p.rateLimited && !p.busy && !over) p.onNext();
                }
              }}
            />
            <div className="idea-foot">
              <VoiceOrb status={p.voiceStatus} level={p.voiceLevel} lang={p.lang} onClick={p.onOrb} />
              <span className={`count ${over ? "count-over" : ""}`}>
                {n}/{LIMITS.answer}
              </span>
            </div>
          </div>
          {p.partial && <p className="partial">… {p.partial}</p>}
          <p className="hint">{t(p.lang, "voiceHintAnswer")}</p>

          {p.notice}

          <div className="row-actions">
            <button type="button" className="btn btn-ghost" onClick={p.onSkip} disabled={p.busy || p.rateLimited}>
              {t(p.lang, "skip")}
            </button>
            <button type="button" className="btn btn-light" onClick={p.onNext} disabled={p.busy || p.rateLimited || over || !p.draft.trim()}>
              {last ? t(p.lang, "makePlan") : t(p.lang, "next")} <IconArrow size={16} />
            </button>
          </div>
          <div className="clarify-plan-now-wrap">
            <button type="button" className="btn btn-sub-action" onClick={p.onPlanNow} disabled={p.busy || p.rateLimited}>
              ⚡ {t(p.lang, "planNow")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
