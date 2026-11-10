import { useState } from "react";
import { EXAMPLES } from "../data/examples";

// Static example block: idea -> questions asked first -> plan card. Works with no backend.
export function DemoBlock() {
  const [i, setI] = useState(0);
  const ex = EXAMPLES[i] ?? EXAMPLES[0];
  if (!ex) return null;

  return (
    <section className="section" id="examples" aria-labelledby="examples-title">
      <div className="section-head">
        <p className="eyebrow">Examples</p>
        <h2 id="examples-title" className="h2">From one sentence to a plan</h2>
        <p className="lead">Pick an idea and see what Sutra asks first, then what it hands back.</p>
      </div>

      <div className="pills" role="tablist" aria-label="Example ideas">
        {EXAMPLES.map((e, idx) => (
          <button
            key={e.tab}
            type="button"
            role="tab"
            aria-selected={idx === i}
            className={`pill ${idx === i ? "on" : ""}`}
            onClick={() => setI(idx)}
          >
            {e.tab}
          </button>
        ))}
      </div>

      <div className="demo" role="tabpanel">
        <div className="demo-left">
          <div className="card">
            <div className="card-label">YOUR IDEA, SPOKEN</div>
            <p className="card-body mono">“{ex.idea}”</p>
          </div>
          <div className="card">
            <div className="card-label">SUTRA ASKS FIRST</div>
            <ol className="card-body mono qlist">
              {ex.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </div>
        </div>

        <div className="plan demo-plan">
          <header className="plan-head">
            <span className="dot" aria-hidden="true" />
            <span className="plan-id">{ex.planId} · {ex.planTitle}</span>
          </header>
          <div className="plan-body mono-body">
            <p><strong>Goal.</strong> {ex.goal}</p>
            <h3 className="plan-label">Acceptance criteria</h3>
            <ul className="plist">
              {ex.acceptance.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="muted">{ex.footer}</p>
          </div>
        </div>
      </div>
      <p className="fineprint">Example outputs, abridged. Your plan is generated from your idea and your answers.</p>
    </section>
  );
}
