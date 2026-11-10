import { IconMic, IconArrow } from "./Icons";

interface Props {
  onStartVoice: () => void;
  onTrySample: () => void;
}

export function FinalCta({ onStartVoice, onTrySample }: Props) {
  return (
    <section className="section final-cta-section" id="start" aria-labelledby="cta-heading">
      <div className="final-cta-card">
        <div className="final-cta-glow" aria-hidden="true" />
        <div className="final-cta-content">
          <p className="eyebrow">Ready to ship?</p>
          <h2 id="cta-heading" className="final-cta-title" style={{ textWrap: "balance" }}>
            Speak your idea once. Build what actually matters.
          </h2>
          <p className="final-cta-sub" style={{ textWrap: "pretty" }}>
            No sign up, no forms, no scope creep. Get a validated vertical slice blueprint, architecture diagram, and agent prompt in under two minutes.
          </p>
          <div className="final-cta-actions">
            <button
              type="button"
              className="btn btn-cta"
              onClick={onStartVoice}
            >
              <IconMic size={18} />
              <span>Start Speaking Your Idea</span>
              <IconArrow size={16} />
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onTrySample}
            >
              Try a sample idea
            </button>
          </div>
          <p className="final-cta-meta">
            Powered by Gnani AI Indic Voice and Groq Llama 3.1
          </p>
        </div>
      </div>
    </section>
  );
}
