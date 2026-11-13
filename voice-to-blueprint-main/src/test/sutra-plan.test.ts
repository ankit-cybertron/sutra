import { describe, expect, it } from "vitest";
import { mockApi } from "@/lib/sutra/mock";
import { planToMarkdown, slugify } from "@/lib/sutra/markdown";

describe("Sutra plan rules", () => {
  it("a chat refinement bumps the plan from v1 to v2 with a change summary", async () => {
    const s = await mockApi.createSession({ idea: "Doctor clinic slot booking on WhatsApp", lang: "en", source: "text" });
    const doc = await mockApi.generatePlan(s.sessionId, []);
    expect(doc.version).toBe(1);
    const r = await mockApi.chat(doc.id, { message: "Add rate limiting to the API", source: "text", lang: "en" });
    expect(r.plan?.version).toBe(2);
    expect(r.changeSummary.length).toBeGreaterThan(0);
  }, 15000);

  it("returns at most 2 clarifying questions and at most 5 must-haves", async () => {
    const s = await mockApi.createSession({ idea: "Freelance invoice tracker", lang: "auto", source: "text" });
    expect(s.questions.length).toBeLessThanOrEqual(2);
    const doc = await mockApi.generatePlan(s.sessionId, []);
    expect(doc.plan.mustHave.length).toBeLessThanOrEqual(5);
    expect(planToMarkdown(doc)).toContain(`# ${doc.plan.title}`);
  }, 15000);

  it("download filename follows <title>-v<version>.md", () => {
    expect(`${slugify("Tiffin Orders!")}-v1.md`).toBe("tiffin-orders-v1.md");
  });
});
