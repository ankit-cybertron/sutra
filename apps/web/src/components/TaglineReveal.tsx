import { useEffect, useRef, useState } from "react";

interface Props {
  tagline?: string;
}

const DEFAULT_TAGLINE =
  "Turn chaotic voice brainstorms into strict technical blueprints that AI coding agents can build without hallucination or scope creep.";

export function TaglineReveal({ tagline = DEFAULT_TAGLINE }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const rect = el.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      // Start reveal when top of container enters 85% of viewport, finish by 35%
      const start = windowHeight * 0.85;
      const end = windowHeight * 0.35;
      const current = rect.top;

      if (current > start) {
        setProgress(0);
      } else if (current < end) {
        setProgress(1);
      } else {
        const ratio = (start - current) / (start - end);
        setProgress(Math.max(0, Math.min(1, ratio)));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const words = tagline.split(" ");
  const activeCount = Math.floor(progress * words.length);

  return (
    <section className="tagline-reveal-section" ref={containerRef} aria-label="Product Manifesto">
      <div className="tagline-reveal-inner">
        <p className="tagline-eyebrow">The Manifesto</p>
        <h2 className="tagline-text" style={{ textWrap: "balance" }}>
          {words.map((word, i) => {
            const isVisible = i <= activeCount;
            return (
              <span
                key={`${word}-${i}`}
                className={`tagline-word ${isVisible ? "word-active" : "word-inactive"}`}
                style={{
                  transitionDelay: `${(i % 5) * 30}ms`,
                }}
              >
                {word}
              </span>
            );
          })}
        </h2>
        <div className="tagline-badge-row">
          <span className="tagline-pill">Indic Voice Recognition</span>
          <span className="tagline-pill">Instant Groq Synthesis</span>
          <span className="tagline-pill">Zero Hallucinations</span>
        </div>
      </div>
    </section>
  );
}
