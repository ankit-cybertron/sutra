import { useEffect, useState } from "react";
import type { Lang } from "../api/types";
import { t } from "../lib/i18n";
import { IconCheck } from "./Icons";

// Structured LLM output cannot be streamed token by token, so we show honest staged progress instead.
export function GeneratingPanel({ lang }: { lang: Lang }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => Math.min(2, s + 1)), 1800);
    return () => window.clearInterval(id);
  }, []);
  const steps = [t(lang, "gen1"), t(lang, "gen2"), t(lang, "gen3")];

  return (
    <section className="work work-center" aria-live="polite" aria-busy="true">
      <div className="card card-strong gen">
        <div className="card-label">{t(lang, "genTitle")}</div>
        <ol className="gen-list">
          {steps.map((s, i) => (
            <li key={i} className={i < step ? "done" : i === step ? "now" : ""}>
              <span className="gen-dot" aria-hidden="true">{i < step ? <IconCheck size={12} /> : null}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="bar" aria-hidden="true"><i /></div>
      </div>
    </section>
  );
}
