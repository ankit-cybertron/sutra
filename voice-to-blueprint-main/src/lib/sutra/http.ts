import type {
  Api,
  AnswerInput,
  ArchitectureDiagramResult,
  ChatInput,
  ChatResult,
  CreateSessionInput,
  CreateSessionResult,
  HealthResponse,
  Lang,
  PlanDoc,
} from "./types";

// Real HTTP client for the Sutra FastAPI backend. Enabled when VITE_SUTRA_API_BASE is set.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

function deviceId(): string {
  if (typeof window === "undefined") return "ssr";
  const k = "sutra.deviceId";
  let id = window.localStorage.getItem(k);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(k, id);
  }
  return id;
}

export function createHttpApi(base: string): Api {
  async function raw(path: string, body?: unknown, timeoutMs = 30_000): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(base + path, {
        method: body !== undefined ? "POST" : "GET",
        headers: { "Content-Type": "application/json", "X-Device-Id": deviceId() },
        body: body !== undefined ? JSON.stringify(body) : null,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        let p: { code?: string; detail?: string; title?: string; retryAfter?: number } = {};
        try {
          p = await res.json();
        } catch {
          /* non-JSON */
        }
        throw new ApiError(res.status, p.code ?? "INTERNAL", p.detail ?? p.title ?? res.statusText, p.retryAfter);
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
  const json = async <T,>(path: string, body?: unknown, t?: number) => (await raw(path, body, t)).json() as Promise<T>;

  return {
    createSession: (input: CreateSessionInput) => json<CreateSessionResult>("/api/sessions", input),
    generatePlan: (sessionId: string, answers: AnswerInput[]) =>
      json<PlanDoc>(`/api/sessions/${encodeURIComponent(sessionId)}/plan`, { answers }, 60_000),
    chat: (planId: string, input: ChatInput) =>
      json<ChatResult>(`/api/plans/${encodeURIComponent(planId)}/chat`, input, 45_000),
    getPlan: (planId: string) => json<PlanDoc>(`/api/plans/${encodeURIComponent(planId)}`),
    health: () => json<HealthResponse>("/api/health"),
    tts: async (text: string, lang: Lang) => (await raw("/api/tts", { text, lang }, 20_000)).blob(),
    generateArchitectureDiagram: (planId: string, markdown?: string) =>
      json<ArchitectureDiagramResult>(
        `/api/plans/${encodeURIComponent(planId)}/architecture-diagram`,
        { markdown },
        45_000,
      ),
  };
}
