import { useState } from "react";
import type { Lang, PlanDoc } from "../api/types";
import { BRAND } from "../brand";
import { t } from "../lib/i18n";
import { downloadText, planToMarkdown, slug } from "../lib/markdown";
import { IconCheck, IconCopy, IconDownload } from "./Icons";

interface Props {
  doc: PlanDoc;
  lang: Lang;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function List({ items }: { items: string[] }) {
  if (!items.length) return <p className="muted">—</p>;
  return (
    <ul className="plist">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

// All plan text is rendered as plain React text nodes. Never use dangerouslySetInnerHTML for model output.
export function PlanCard({ doc, lang }: Props) {
  const { plan } = doc;
  const [copied, setCopied] = useState<"md" | "prompt" | null>(null);

  const flash = (k: "md" | "prompt") => {
    setCopied(k);
    window.setTimeout(() => setCopied(null), 1600);
  };

  return (
    <article className="plan" aria-label={plan.title}>
      <header className="plan-head">
        <span className="dot" aria-hidden="true" />
        <span className="plan-id">
          {BRAND.planPrefix}-{doc.id.replace(/^p_/, "").slice(0, 3).toUpperCase()} · {plan.title.toUpperCase()}
        </span>
        <div className="plan-badges">
          <span className="plan-readiness" title="Agent build readiness score">
            READINESS {plan.readinessScore || 92}/100
          </span>
          <span className="plan-ver">{t(lang, "version", { n: doc.version })}</span>
        </div>
      </header>

      <div className="plan-body">
        <p className="plan-one">{plan.oneLiner}</p>

        {doc.changeSummary.length > 0 && (
          <div className="changed" role="status">
            <div className="plan-label">{t(lang, "changed")}</div>
            <ul className="plist">
              {doc.changeSummary.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <section>
          <h3 className="plan-label">{t(lang, "pGoal")}</h3>
          <p>{plan.problem}</p>
        </section>
        <section>
          <h3 className="plan-label">{t(lang, "pUser")}</h3>
          <p>{plan.targetUser}</p>
        </section>

        {plan.coreLoop && plan.coreLoop.length > 0 && (
          <section className="core-loop-section">
            <h3 className="plan-label">{lang === "hi" ? "कोर लूप (3 चरण)" : lang === "hinglish" ? "CORE LOOP" : "CORE LOOP"}</h3>
            <ol className="core-loop-steps">
              {plan.coreLoop.map((step, i) => (
                <li key={i} className="core-loop-item">
                  <span className="core-step-badge">{i + 1}</span>
                  <span className="core-step-text">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section>
          <h3 className="plan-label">{t(lang, "pMust")}</h3>
          <ol className="must">
            {plan.mustHave.map((m, i) => (
              <li key={i}>
                <strong>{m.name}</strong>
                <span className="muted"> — {m.why}</span>
                <div className="sub-label">{t(lang, "pAcceptance")}</div>
                <List items={m.acceptance} />
              </li>
            ))}
          </ol>
        </section>

        <div className="two">
          <section>
            <h3 className="plan-label">{t(lang, "pLater")}</h3>
            <List items={plan.later} />
          </section>
          <section>
            <h3 className="plan-label">{t(lang, "pOut")}</h3>
            <List items={plan.outOfScope} />
          </section>
        </div>

        <section>
          <h3 className="plan-label">{t(lang, "pBuild")}</h3>
          <ol className="steps">
            {plan.buildOrder.map((b) => (
              <li key={b.step}>
                <strong>{b.title}</strong>
                <span className="muted"> — {b.detail}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="plan-label">{t(lang, "pTech")}</h3>
          <p>{plan.techNotes}</p>
        </section>

        <div className="two">
          <section>
            <h3 className="plan-label">{t(lang, "pRisks")}</h3>
            <List items={plan.risks} />
          </section>
          <section>
            <h3 className="plan-label">{t(lang, "pAssume")}</h3>
            <List items={plan.assumptions} />
          </section>
        </div>

        {plan.openQuestions.length > 0 && (
          <section>
            <h3 className="plan-label">{t(lang, "pOpen")}</h3>
            <List items={plan.openQuestions} />
          </section>
        )}

        <section>
          <h3 className="plan-label">{t(lang, "pPrompt")}</h3>
          <pre className="prompt">{plan.firstPrompt}</pre>
        </section>
      </div>

      <footer className="plan-foot">
        <button
          type="button"
          className="btn btn-light btn-sm"
          onClick={async () => {
            if (await copyText(planToMarkdown(plan, doc.version))) flash("md");
          }}
        >
          {copied === "md" ? <IconCheck size={16} /> : <IconCopy size={16} />}
          <span aria-live="polite">{copied === "md" ? t(lang, "copied") : t(lang, "copyMd")}</span>
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={async () => {
            if (await copyText(plan.firstPrompt)) flash("prompt");
          }}
        >
          {copied === "prompt" ? <IconCheck size={16} /> : <IconCopy size={16} />}
          <span aria-live="polite">{copied === "prompt" ? t(lang, "copied") : t(lang, "copyPrompt")}</span>
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => downloadText(`${slug(plan.title)}-v${doc.version}.md`, planToMarkdown(plan, doc.version))}
        >
          <IconDownload size={16} /> {t(lang, "downloadMd")}
        </button>
      </footer>
    </article>
  );
}
