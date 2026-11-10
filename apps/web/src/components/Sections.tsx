import type { ReactNode } from "react";
import { IconChat, IconHelp, IconLock, IconMic, IconTarget, IconTerminal } from "./Icons";

export function HowItWorks() {
  const steps = [
    ["01", "Talk", "Say or type the idea. Hindi, Hinglish and English all work, and false starts are fine."],
    ["02", "Answer one or two questions", "Sutra only asks what changes the build, and reads each question out loud."],
    ["03", "Get the plan, then keep talking", "Review a scoped plan, then add suggestions by voice and watch the plan update."],
  ] as const;
  return (
    <section className="section" id="how" aria-labelledby="how-title">
      <div className="section-head">
        <p className="eyebrow">How it works</p>
        <h2 id="how-title" className="h2">Three steps. No forms.</h2>
      </div>
      <ol className="how">
        {steps.map(([n, title, body]) => (
          <li key={n}>
            <span className="how-n">{n}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface Feature {
  icon: ReactNode;
  title: string;
  sub: string;
  body: string;
  detail: string;
}

const FEATURES: Feature[] = [
  {
    icon: <IconMic />,
    title: "Voice that never waits",
    sub: "The mic is already on.",
    body: "Speak the moment the page loads. Sutra listens on every step, in Hindi, Hinglish or English, with no push-to-talk.",
    detail: "Streaming speech recognition by Gnani AI Prisma. Audio is used for transcription only and is never stored.",
  },
  {
    icon: <IconHelp />,
    title: "Questions that matter",
    sub: "One or two, never twenty.",
    body: "Sutra asks only what would change what you build, in your own language, and reads each question out loud so you can just answer.",
    detail: "Skip any question by saying “skip” or “chhodo”. Unanswered gaps become visible assumptions.",
  },
  {
    icon: <IconTarget />,
    title: "Scoped plans",
    sub: "Small enough to ship.",
    body: "A short must-have list with acceptance criteria, a build order, and an explicit list of what is not in version one.",
    detail: "Anything that would blow the scope is parked under Later, with the reason written next to it.",
  },
  {
    icon: <IconChat />,
    title: "Talk to your plan",
    sub: "Change it by speaking.",
    body: "Say “add dark mode” or ask “why is this later?”. Sutra answers, updates the plan and tells you exactly what changed.",
    detail: "Every change creates a new version, so nothing is lost.",
  },
  {
    icon: <IconTerminal />,
    title: "Hand-off to your coding agent",
    sub: "Copy, paste, build.",
    body: "Export clean Markdown plus a self-contained first prompt for Antigravity, Cursor or Claude Code, ending with a do-not-build list.",
    detail: "One click to copy the plan or the first prompt, or download it as a file.",
  },
  {
    icon: <IconLock />,
    title: "Private and protected",
    sub: "No account, no tracking.",
    body: "No sign-up. Your idea is checked for abuse and prompt-injection before it reaches the model, and requests are rate limited.",
    detail: "Plans are stored on this device's anonymous id only. Delete a plan at any time.",
  },
];

export function Features() {
  return (
    <section className="section" id="features" aria-labelledby="features-title">
      <div className="section-head">
        <p className="eyebrow">Features</p>
        <h2 id="features-title" className="h2">Everything you need. Nothing you don't.</h2>
        <p className="lead">Sutra is deliberately small: it helps you decide what to build first, and then gets out of the way.</p>
      </div>
      <div className="features">
        {FEATURES.map((f) => (
          <div className="feature" key={f.title}>
            <div className="feature-l">
              <div className="tile">{f.icon}</div>
              <h3>{f.title}</h3>
              <p className="muted">{f.sub}</p>
            </div>
            <div className="feature-r">
              <p>{f.body}</p>
              <p className="feature-detail">{f.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
