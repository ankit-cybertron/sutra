import { describe, expect, it } from "vitest";
import { evaluateProjectReadiness } from "@/lib/sutra/readiness";
import type { Plan } from "@/lib/sutra/types";

describe("evaluateProjectReadiness", () => {
  it("scores an incomplete plan appropriately low", () => {
    const minimalPlan: Plan = {
      title: "Mini App",
      oneLiner: "A small app",
      targetUser: "People",
      problem: "Needs an app",
      coreLoop: [],
      mustHave: [],
      later: [],
      outOfScope: [],
      buildOrder: [],
      techNotes: "",
      risks: [],
      assumptions: [],
      openQuestions: ["What stack?", "Who pays?", "Where to host?", "What database?"],
      firstPrompt: "",
      language: "en",
    };

    const result = evaluateProjectReadiness(minimalPlan);
    expect(result.overallScore).toBeLessThan(40);
    expect(result.grade).toBe("Draft / Incomplete");
    expect(result.missingRequirements.length).toBeGreaterThan(0);
    expect(result.factors.length).toBe(10);
  });

  it("scores a production-grade plan high and identifies concrete factors", () => {
    const completePlan: Plan = {
      title: "BusTrack",
      oneLiner: "Real-time school bus tracking with parent notifications and driver dispatch",
      targetUser: "School administrators, bus drivers, and parents who need accurate ETA tracking",
      problem: "Parents experience anxiety when school buses are delayed and schools lack visibility into bus locations and attendance",
      coreLoop: [
        "Driver starts route and location pings are streamed via WebSocket",
        "Parent receives push/WhatsApp notification when bus enters 500m geofence",
        "Student RFID card is scanned on boarding to confirm school attendance",
      ],
      mustHave: [
        {
          name: "Real-time GPS Tracking",
          why: "Provides live bus coordinates to parents and dispatchers",
          acceptance: [
            "Coordinates update every 5 seconds over secure WebSocket",
            "Geofence breach triggers immediate parent push alert",
          ],
        },
        {
          name: "Parent Authentication & Child Association",
          why: "Ensures privacy so parents only see their assigned buses",
          acceptance: [
            "JWT bearer token validation with role-based access control (RBAC)",
            "OTP verification via mobile number",
          ],
        },
        {
          name: "Student Attendance Boarding Scan",
          why: "Verifies student boarded correct bus at scheduled stop",
          acceptance: [
            "Scan updates PostgreSQL attendance records within 1 second",
            "Missing student alert sent if not boarded by route departure",
          ],
        },
      ],
      later: ["Automated route optimization", "Monthly fee billing via Stripe"],
      outOfScope: ["In-bus entertainment streaming", "Driver payroll management"],
      buildOrder: [
        { step: 1, title: "Database schema & auth", detail: "PostgreSQL tables for routes, buses, and JWT auth" },
        { step: 2, title: "FastAPI REST & WebSocket endpoints", detail: "Telemetry ingestion with Redis caching" },
        { step: 3, title: "React SPA dashboard", detail: "Live map view with Tailwind and Mapbox" },
      ],
      techNotes: "FastAPI backend, React 19 SPA frontend, PostgreSQL primary store, Redis for pub/sub, Dockerized deployment",
      risks: [
        "Intermittent cellular connectivity in rural transport zones",
        "High GPS polling frequency draining driver mobile device battery",
        "Spike in WebSocket connections during school dismissal hours",
      ],
      assumptions: [
        "Drivers possess smartphones with cellular GPS capability",
        "Parents have WhatsApp or smartphone for instant notifications",
      ],
      openQuestions: ["Which SMS/WhatsApp gateway provider offers best Indian telecom SLA?"],
      firstPrompt: "Let's build BusTrack backend with FastAPI, PostgreSQL, and WebSockets.",
      language: "en",
    };

    const result = evaluateProjectReadiness(completePlan);
    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(["High Readiness", "Production Ready"]).toContain(result.grade);
    expect(result.factors.find((f) => f.id === "database")?.status).toBe("complete");
    expect(result.factors.find((f) => f.id === "security")?.status).toBe("complete");
    expect(result.factors.find((f) => f.id === "architecture")?.status).toBe("complete");
  });
});
