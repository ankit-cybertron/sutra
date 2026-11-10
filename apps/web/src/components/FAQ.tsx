import { useState } from "react";
import { IconChevron } from "./Icons";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: "Which languages does Sutra understand?",
    answer:
      "Full native support for Indian English, Hindi, and colloquial Hinglish. The speech pipeline uses Gnani AI Prisma v3 ASR calibrated for natural code mixing and varied Indian accents.",
  },
  {
    question: "Do I need to sign up or provide an API key?",
    answer:
      "No. Sutra requires no sign up, no email, and no credit card. All plans are stored locally in your browser session with anonymous device storage.",
  },
  {
    question: "How does this prevent AI scope creep?",
    answer:
      "Standard chatbots tend to expand specifications with unnecessary enterprise patterns. Sutra enforces radical vertical slice discipline: maximum five must haves, clear acceptance criteria, and an explicit out of scope list.",
  },
  {
    question: "How are architecture diagrams generated?",
    answer:
      "Sutra analyzes the blueprint using Gemini 2.5 Flash to extract the exact components, data flows, and external services documented in your plan. It renders standard Mermaid diagrams locally at zero cost.",
  },
  {
    question: "What happens if voice recognition or network fails?",
    answer:
      "Sutra includes automatic fallback mechanisms. If the streaming voice connection drops, it falls back to the native browser speech engine. You can also type your idea and keyboard shortcuts at any point.",
  },
  {
    question: "Which coding agents can I use with the generated blueprint?",
    answer:
      "The exported first prompt is specifically tuned for Google Antigravity, Cursor Composer, Anthropic Claude Code, and GitHub Copilot Workspace. Just copy and paste directly into your agent prompt.",
  },
  {
    question: "Can I refine or change the plan after it is generated?",
    answer:
      "Yes. Once your blueprint appears, you can speak or type revisions such as 'add dark mode' or 'switch from PostgreSQL to SQLite'. Sutra creates a new plan version with clear change diffs.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section className="section faq-section" id="faq" aria-labelledby="faq-title">
      <div className="section-head">
        <p className="eyebrow">Got Questions?</p>
        <h2 id="faq-title" className="h2" style={{ textWrap: "balance" }}>
          Frequently Asked Questions
        </h2>
        <p className="lead" style={{ textWrap: "pretty" }}>
          Everything you need to know about how Sutra turns spoken brainstorms into actionable code.
        </p>
      </div>

      <div className="faq-list">
        {FAQS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={item.question} className={`faq-card ${isOpen ? "faq-open" : ""}`}>
              <button
                type="button"
                className="faq-question-btn"
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
              >
                <span className="faq-q-text">{item.question}</span>
                <span className={`faq-icon ${isOpen ? "rotate-icon" : ""}`}>
                  <IconChevron size={18} />
                </span>
              </button>
              {isOpen && (
                <div className="faq-answer">
                  <p style={{ textWrap: "pretty" }}>{item.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
