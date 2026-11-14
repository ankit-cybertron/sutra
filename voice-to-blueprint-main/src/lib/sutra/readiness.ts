import type { Plan } from "./types";

export interface ReadinessFactor {
  id: string;
  name: string;
  weight: number;
  score: number;
  status: "complete" | "partial" | "missing";
  explanation: string;
  recommendation?: string;
}

export interface ReadinessEvaluation {
  overallScore: number;
  grade: "Production Ready" | "High Readiness" | "Moderate Readiness" | "Draft / Incomplete";
  summary: string;
  factors: ReadinessFactor[];
  missingRequirements: string[];
  actionableSuggestions: string[];
}

/**
 * Calculates a genuine, dynamic project readiness score (0-100) based on actual
 * requirements completeness, technical architecture, database design, security, and planning.
 */
export function evaluateProjectReadiness(p: Plan): ReadinessEvaluation {
  const allText = [
    p.title,
    p.oneLiner,
    p.problem,
    p.targetUser,
    p.techNotes,
    p.firstPrompt,
    ...(p.coreLoop || []),
    ...p.mustHave.map((m) => `${m.name} ${m.why} ${m.acceptance.join(" ")}`),
    ...p.later,
    ...p.outOfScope,
    ...p.buildOrder.map((b) => `${b.title} ${b.detail}`),
    ...p.risks,
    ...p.assumptions,
    ...p.openQuestions,
  ]
    .join(" ")
    .toLowerCase();

  const missingRequirements: string[] = [];
  const actionableSuggestions: string[] = [];
  const factors: ReadinessFactor[] = [];

  // 1. Requirements Completeness (10 pts)
  let reqScore = 0;
  if (p.targetUser && p.targetUser.length > 15) reqScore += 3;
  if (p.problem && p.problem.length > 25) reqScore += 3;
  if (p.coreLoop && p.coreLoop.length >= 3) reqScore += 4;
  else if (p.coreLoop && p.coreLoop.length > 0) reqScore += 2;
  else {
    missingRequirements.push("Core user journey loop is missing or incomplete");
    actionableSuggestions.push("Define a step-by-step core user journey loop");
  }
  if (p.openQuestions && p.openQuestions.length > 3) reqScore = Math.max(0, reqScore - 2);

  factors.push({
    id: "requirements",
    name: "Requirements Completeness",
    weight: 10,
    score: reqScore,
    status: reqScore >= 8 ? "complete" : reqScore >= 5 ? "partial" : "missing",
    explanation:
      reqScore >= 8
        ? "Target users, core problem, and user loops are well specified."
        : "Some requirements or user loops need more specific definition.",
  });

  // 2. Feature Definition & Acceptance Criteria (12 pts)
  let featScore = 0;
  if (p.mustHave && p.mustHave.length >= 3) featScore += 5;
  else if (p.mustHave && p.mustHave.length > 0) featScore += 3;
  else missingRequirements.push("No must-have features defined");

  const totalCriteria = p.mustHave.reduce((acc, m) => acc + (m.acceptance?.length || 0), 0);
  const avgCriteria = p.mustHave.length ? totalCriteria / p.mustHave.length : 0;
  if (avgCriteria >= 2.5) featScore += 4;
  else if (avgCriteria >= 1) featScore += 2;
  else missingRequirements.push("Features lack explicit acceptance criteria");

  if (p.later?.length > 0 && p.outOfScope?.length > 0) featScore += 3;
  else if (p.later?.length > 0 || p.outOfScope?.length > 0) featScore += 1;

  factors.push({
    id: "features",
    name: "Feature Definition",
    weight: 12,
    score: featScore,
    status: featScore >= 10 ? "complete" : featScore >= 6 ? "partial" : "missing",
    explanation:
      featScore >= 10
        ? "Features have granular acceptance criteria and scope boundaries."
        : "Add more detailed testable acceptance criteria to your must-haves.",
  });

  // 3. Technical Architecture (10 pts)
  let archScore = 0;
  if (p.techNotes && p.techNotes.length > 60) archScore += 4;
  const hasClient = /react|vue|svelte|next|web|spa|mobile|flutter|client|ios|android/.test(allText);
  const hasApi = /api|rest|fastapi|express|backend|graphql|router|gateway/.test(allText);
  const hasWorker = /queue|worker|celery|job|async|redis|cron|background/.test(allText);
  if (hasClient && hasApi) archScore += 4;
  else if (hasClient || hasApi) archScore += 2;
  if (hasWorker) archScore += 2;

  factors.push({
    id: "architecture",
    name: "Technical Architecture",
    weight: 10,
    score: archScore,
    status: archScore >= 8 ? "complete" : archScore >= 5 ? "partial" : "missing",
    explanation:
      archScore >= 8
        ? "Clear multi-tier client/server architectural separation."
        : "Elaborate the system architecture and responsibilities between layers.",
    recommendation: "Ask Co-pilot: 'Specify our frontend and backend architectural separation'",
  });

  // 4. Database & Storage Design (10 pts)
  let dbScore = 0;
  const hasDbTech = /postgres|postgresql|mysql|sqlite|mongodb|redis|prisma|sqlalchemy|dynamo|supabase/.test(allText);
  const hasDbModel = /schema|table|relation|foreign key|index|crud|persist|store|cache|entity|collection/.test(allText);
  if (hasDbTech) dbScore += 5;
  else {
    missingRequirements.push("Specific database technology is not named");
    actionableSuggestions.push("Name a concrete primary database (e.g. PostgreSQL, Redis)");
  }
  if (hasDbModel) dbScore += 5;
  else {
    missingRequirements.push("Data schema or storage models are not outlined");
  }

  factors.push({
    id: "database",
    name: "Database & Storage Design",
    weight: 10,
    score: dbScore,
    status: dbScore >= 8 ? "complete" : dbScore >= 5 ? "partial" : "missing",
    explanation:
      dbScore >= 8
        ? "Database engine and schema models are identified."
        : "Define your primary database engine and table/document schemas.",
    recommendation: "Ask Co-pilot: 'Add database schema design and caching strategy'",
  });

  // 5. API & Integrations (10 pts)
  let apiScore = 0;
  const hasProtocol = /rest|websocket|graphql|http|json|grpc|webhook/.test(allText);
  const hasIntegration = /whatsapp|twilio|stripe|paypal|razorpay|oauth|smtp|mail|groq|gemini|openai|ai|third-party|meta|sdk/.test(allText);
  if (hasProtocol) apiScore += 5;
  if (hasIntegration) apiScore += 5;
  else {
    missingRequirements.push("External service integration protocols not detailed");
  }

  factors.push({
    id: "api",
    name: "API & Integrations",
    weight: 10,
    score: apiScore,
    status: apiScore >= 8 ? "complete" : apiScore >= 5 ? "partial" : "missing",
    explanation:
      apiScore >= 8
        ? "API communication protocols and external APIs are documented."
        : "Specify the communication protocols and external API endpoints.",
  });

  // 6. Security Considerations & Authentication (10 pts)
  let secScore = 0;
  const hasAuth = /auth|jwt|oauth|session|token|login|otp|password|rbac|permission|bcrypt|credentials/.test(allText);
  const hasSecPractice = /rate limit|cors|encrypt|sanitize|validation|helmet|csrf|https|tls|hash/.test(allText);
  if (hasAuth) secScore += 5;
  else {
    missingRequirements.push("User authentication & authorization method missing");
    actionableSuggestions.push("Specify authentication (e.g. JWT, OAuth, or WhatsApp OTP)");
  }
  if (hasSecPractice) secScore += 5;
  else {
    missingRequirements.push("Security practices (rate limiting, validation, encryption) not noted");
  }

  factors.push({
    id: "security",
    name: "Security & Authentication",
    weight: 10,
    score: secScore,
    status: secScore >= 8 ? "complete" : secScore >= 5 ? "partial" : "missing",
    explanation:
      secScore >= 8
        ? "Authentication flows and core security safeguards are included."
        : "Specify authentication mechanism and input validation/rate-limiting.",
    recommendation: "Ask Co-pilot: 'Add user authentication and API security safeguards'",
  });

  // 7. Technology Stack Specificity (10 pts)
  let stackScore = 0;
  const hasLangFramework = /python|node|typescript|javascript|golang|rust|react|fastapi|express|next|django/.test(allText);
  const hasTooling = /vite|docker|tailwind|pydantic|pytest|vitest|eslint|npm|pip|poetry/.test(allText);
  if (hasLangFramework) stackScore += 5;
  if (hasTooling) stackScore += 5;

  factors.push({
    id: "stack",
    name: "Technology Stack",
    weight: 10,
    score: stackScore,
    status: stackScore >= 8 ? "complete" : stackScore >= 5 ? "partial" : "missing",
    explanation:
      stackScore >= 8
        ? "Explicit frameworks, languages, and build tools are defined."
        : "Specify explicit framework versions and developer libraries.",
  });

  // 8. Deployment & Infrastructure Readiness (8 pts)
  let infraScore = 0;
  const hasDeployment = /docker|dockerfile|kubernetes|k8s|container|vercel|aws|gcp|railway|render|fly\.io|nginx|cloudflare/.test(allText);
  const hasConfig = /env|environment variable|ci\/cd|github actions|deploy|cluster|domain|ssl/.test(allText);
  if (hasDeployment) infraScore += 4;
  else {
    missingRequirements.push("Containerization or deployment target not specified");
    actionableSuggestions.push("Add deployment strategy (e.g. Docker, Railway, or AWS)");
  }
  if (hasConfig) infraScore += 4;

  factors.push({
    id: "deployment",
    name: "Deployment Readiness",
    weight: 8,
    score: infraScore,
    status: infraScore >= 6 ? "complete" : infraScore >= 4 ? "partial" : "missing",
    explanation:
      infraScore >= 6
        ? "Containerization, cloud host, and deployment targets are specified."
        : "Outline your deployment environment, Dockerfile, or hosting provider.",
    recommendation: "Ask Co-pilot: 'Add Docker container setup and deployment instructions'",
  });

  // 9. Technical Risks & Assumptions (10 pts)
  let riskScore = 0;
  if (p.risks && p.risks.length >= 3) riskScore += 5;
  else if (p.risks && p.risks.length > 0) riskScore += 3;
  else missingRequirements.push("No technical risks identified");

  if (p.assumptions && p.assumptions.length >= 2) riskScore += 5;
  else if (p.assumptions && p.assumptions.length > 0) riskScore += 3;

  factors.push({
    id: "risks",
    name: "Technical Risks",
    weight: 10,
    score: riskScore,
    status: riskScore >= 8 ? "complete" : riskScore >= 5 ? "partial" : "missing",
    explanation:
      riskScore >= 8
        ? "Clear mitigation analysis for potential technical pitfalls and assumptions."
        : "Identify edge-case technical risks and operational assumptions.",
  });

  // 10. Implementation Planning & Build Order (10 pts)
  let planScore = 0;
  if (p.buildOrder && p.buildOrder.length >= 4) planScore += 5;
  else if (p.buildOrder && p.buildOrder.length > 0) planScore += 3;
  else missingRequirements.push("Build order implementation steps missing");

  if (p.firstPrompt && p.firstPrompt.length > 80) planScore += 5;
  else if (p.firstPrompt && p.firstPrompt.length > 20) planScore += 2;

  factors.push({
    id: "planning",
    name: "Implementation Planning",
    weight: 10,
    score: planScore,
    status: planScore >= 8 ? "complete" : planScore >= 5 ? "partial" : "missing",
    explanation:
      planScore >= 8
        ? "Sequential implementation build order and ready-to-run first prompt."
        : "Flesh out the phased build order and initial agent prompt.",
  });

  // Sum total score
  const totalRaw = factors.reduce((acc, f) => acc + f.score, 0);
  const overallScore = Math.min(100, Math.max(10, Math.round(totalRaw)));

  let grade: ReadinessEvaluation["grade"] = "Draft / Incomplete";
  let summary = "Initial project scaffold. Several critical technical dimensions require definition.";

  if (overallScore >= 88) {
    grade = "Production Ready";
    summary = "High-confidence technical specification ready for engineering implementation.";
  } else if (overallScore >= 75) {
    grade = "High Readiness";
    summary = "Solid technical plan. A few specific architectural details can be tightened.";
  } else if (overallScore >= 60) {
    grade = "Moderate Readiness";
    summary = "Good core foundation, but key areas (e.g. security, database, or deployment) need specifics.";
  }

  return {
    overallScore,
    grade,
    summary,
    factors,
    missingRequirements,
    actionableSuggestions,
  };
}
