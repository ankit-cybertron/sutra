import type { PlanDoc } from "./types";

export function planToMarkdown(doc: PlanDoc): string {
  const p = doc.plan;
  const L: string[] = [];
  L.push(`# ${p.title}`, "", `> ${p.oneLiner}`, "", `**Plan:** ${doc.id} · v${doc.version}${p.readinessScore ? ` · Readiness ${p.readinessScore}/100` : ""}`, "");
  L.push("## Target user", p.targetUser, "", "## Problem", p.problem, "");
  if (p.coreLoop?.length) L.push("## Core loop", ...p.coreLoop.map((s, i) => `${i + 1}. ${s}`), "");
  L.push("## Must-have");
  p.mustHave.forEach((m) => {
    L.push(`### ${m.name}`, `*Why:* ${m.why}`, ...m.acceptance.map((a) => `- [ ] ${a}`), "");
  });
  L.push("## Later", ...p.later.map((x) => `- ${x}`), "", "## Out of scope", ...p.outOfScope.map((x) => `- ${x}`), "");
  L.push("## Build order", ...p.buildOrder.map((b) => `${b.step}. **${b.title}** — ${b.detail}`), "");
  L.push("## Tech notes", p.techNotes, "", "## Risks", ...p.risks.map((x) => `- ${x}`), "");
  L.push("## Assumptions", ...p.assumptions.map((x) => `- ${x}`), "");
  if (p.openQuestions.length) L.push("## Open questions", ...p.openQuestions.map((x) => `- ${x}`), "");
  L.push("## First prompt", "```", p.firstPrompt, "```", "");
  return L.join("\n");
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sutra-plan";
}
