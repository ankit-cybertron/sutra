// The HTTP contract between this UI and the backend. JSON is camelCase.
// Keep in sync with docs/API_CONTRACT.md. The backend should validate with the same shapes.

export type Lang = "en" | "hi" | "hinglish";
export type LangMode = "auto" | Lang;
export type InputSource = "voice" | "text";

export interface Question {
  id: string;
  displayText: string;
  /** TTS-optimised text (Hindi words in Devanagari, English words in Latin). */
  spokenText: string;
  /** Optional quick-answer chips. */
  options: string[];
}

export interface MustHave {
  name: string;
  why: string;
  acceptance: string[];
}

export interface BuildStep {
  step: number;
  title: string;
  detail: string;
}

export interface Suggestion {
  id: string;
  text: string;
  impact: "low" | "medium" | "high";
}

export interface Plan {
  title: string;
  oneLiner: string;
  targetUser: string;
  problem: string;
  coreLoop?: string[];
  readinessScore?: number;
  /** Max 5, enforced by the backend schema. */
  mustHave: MustHave[];
  later: string[];
  outOfScope: string[];
  buildOrder: BuildStep[];
  techNotes: string;
  risks: string[];
  assumptions: string[];
  openQuestions: string[];
  suggestions: Suggestion[];
  /** Self-contained prompt for a coding agent. */
  firstPrompt: string;
  language: Lang;
}

export interface PlanDoc {
  id: string;
  version: number;
  plan: Plan;
  changeSummary: string[];
  providerNotice?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "ai" | "system";
  text: string;
  source: InputSource;
  ts: number;
}

export interface CreateSessionInput {
  idea: string;
  lang: LangMode;
  source: InputSource;
}
export interface CreateSessionResult {
  sessionId: string;
  detectedLang: Lang;
  /** 0 to 2 questions. */
  questions: Question[];
  providerNotice?: string;
}

export interface AnswerInput {
  questionId: string;
  text: string;
}

export interface ChatInput {
  message: string;
  source: InputSource;
  lang: LangMode;
}
export interface ChatResult {
  reply: string;
  /** TTS-optimised version of `reply`. */
  spokenReply: string;
  /** Present only when the plan changed. */
  plan?: PlanDoc;
  changeSummary: string[];
  providerNotice?: string;
}

export interface ProviderStatus {
  status: "connected" | "mock" | "error" | "unconfigured";
  model?: string;
  mode?: string;
  lastError?: string | null;
  calls?: number;
}

export interface HealthResponse {
  ok: boolean;
  status: string;
  app: string;
  providers?: {
    groq?: ProviderStatus;
    gnani?: ProviderStatus;
  };
  groqModel?: string;
}

export interface ArchitectureDiagramResult {
  planId: string;
  mermaid: string;
  fallbackMermaid?: string;
  model?: string;
  status?: string;
  notice?: string;
}

export interface Api {
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  generatePlan(sessionId: string, answers: AnswerInput[]): Promise<PlanDoc>;
  chat(planId: string, input: ChatInput): Promise<ChatResult>;
  getPlan(planId: string): Promise<PlanDoc>;
  tts(text: string, lang: Lang): Promise<Blob>;
  health(): Promise<HealthResponse>;
  generateArchitectureDiagram(planId: string, markdown?: string): Promise<ArchitectureDiagramResult>;
}
