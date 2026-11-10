import { API_BASE } from "../lib/config";
import { getDeviceId } from "../lib/device";
import { ApiError, toApiError, type ApiErrorCode } from "./errors";
import type { Api, AnswerInput, ChatInput, ChatResult, CreateSessionInput, CreateSessionResult, Lang, PlanDoc } from "./types";

// Real HTTP client. Errors from the backend are RFC 7807 problem+json:
// { type, title, status, code, detail, retryAfter?, requestId? }  (+ a Retry-After header on 429).

interface Problem {
  code?: string;
  detail?: string;
  title?: string;
  retryAfter?: number;
  requestId?: string;
}

async function parseProblem(res: Response): Promise<ApiError> {
  let p: Problem = {};
  try {
    p = (await res.json()) as Problem;
  } catch {
    /* non-JSON error body */
  }
  const header = Number(res.headers.get("Retry-After"));
  const retryAfter = p.retryAfter ?? (Number.isFinite(header) && header > 0 ? header : undefined);
  let code = (p.code as ApiErrorCode | undefined) ?? "INTERNAL";
  if (!p.code) {
    if (res.status === 429) code = "RATE_LIMITED";
    else if (res.status === 413) code = "INPUT_TOO_LONG";
    else if (res.status === 404) code = "NOT_FOUND";
    else if (res.status === 502 || res.status === 503) code = "PROVIDER_UNAVAILABLE";
  }
  // Never show raw server detail for blocked input: the backend must not leak guardrail internals,
  // and the UI shows its own generic message for INPUT_BLOCKED anyway.
  return new ApiError(res.status, code, p.detail ?? p.title ?? res.statusText, retryAfter, p.requestId);
}

async function request<T>(path: string, opts: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await fetch(API_BASE + path, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });
    if (!res.ok) throw await parseProblem(res);
    return (await res.json()) as T;
  } catch (e) {
    throw toApiError(e);
  } finally {
    clearTimeout(timer);
  }
}

export const httpApi: Api = {
  createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    return request("/api/sessions", { body: input });
  },
  generatePlan(sessionId: string, answers: AnswerInput[]): Promise<PlanDoc> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/plan`, { body: { answers }, timeoutMs: 60_000 });
  },
  chat(planId: string, input: ChatInput): Promise<ChatResult> {
    return request(`/api/plans/${encodeURIComponent(planId)}/chat`, { body: input, timeoutMs: 45_000 });
  },
  getPlan(planId: string): Promise<PlanDoc> {
    return request(`/api/plans/${encodeURIComponent(planId)}`);
  },
  async tts(text: string, lang: Lang): Promise<Blob> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(API_BASE + "/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
        body: JSON.stringify({ text, lang }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw await parseProblem(res);
      return await res.blob();
    } catch (e) {
      throw toApiError(e);
    } finally {
      clearTimeout(timer);
    }
  },
};
