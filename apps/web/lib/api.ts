/**
 * VoxSpec API Client for Next.js frontend.
 * Manages authenticated requests, audio upload to Gnani.ai STT, and SSE stream reading.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  latest_score?: number | null;
}

export interface Session {
  id: string;
  project_id: string;
  owner_id: string;
  status: "draft" | "analyzed" | "clarifying" | "compiled";
  lang_hint: string;
  round: number;
  created_at: string;
  updated_at: string;
}

export interface Span {
  start: number;
  end: number;
}

export interface Decision {
  topic: string;
  final: string;
  superseded: string[];
  evidence: Span[];
}

export interface RevisionTraceStep {
  value: string;
  stance: "assert" | "revise" | "retract" | "tentative";
  span: Span;
  superseded: boolean;
}

export interface RevisionTrace {
  topic: string;
  steps: RevisionTraceStep[];
}

export interface Assumption {
  id: string;
  statement: string;
  risk: "low" | "medium" | "high";
  status: "open" | "confirmed" | "rejected";
}

export interface Question {
  id: string;
  text: string;
  why_it_matters: string;
  impact: number;
  options: string[];
  status?: string;
}

export interface ScoreBreakdownItem {
  component: string;
  earned: number;
  max: number;
  reason: string;
}

export interface SpecVersion {
  id: string;
  session_id: string;
  spec_json: Record<string, unknown>;
  readiness_score: number;
  score_breakdown?: ScoreBreakdownItem[];
  markdown_text: string;
  created_at: string;
}

export interface StageEvent {
  stage: "normalize" | "extract" | "resolve" | "gaps" | "compile" | "score" | "render";
  status: "started" | "done" | "failed";
  ms?: number;
  claims_count?: number;
  decisions_count?: number;
  traces_count?: number;
  assumptions_count?: number;
  questions_count?: number;
  title?: string;
  score?: number;
  error?: string;
}

// ── Headers Helper ────────────────────────────────────────────────────────────

function getHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ── Projects API ─────────────────────────────────────────────────────────────

export async function fetchProjects(token?: string | null): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/v1/projects`, {
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch projects: ${res.statusText}`);
  }
  return res.json();
}

export async function createProject(name: string, token?: string | null): Promise<Project> {
  const res = await fetch(`${API_BASE}/v1/projects`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create project: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteProject(id: string, token?: string | null): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/projects/${id}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to delete project: ${res.statusText}`);
  }
}

// ── Sessions API ─────────────────────────────────────────────────────────────

export async function createSession(projectId: string, token?: string | null): Promise<Session> {
  const res = await fetch(`${API_BASE}/v1/projects/${projectId}/sessions`, {
    method: "POST",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to create session: ${res.statusText}`);
  }
  return res.json();
}

export async function saveTranscript(
  sessionId: string,
  rawText: string,
  langHint = "auto",
  token?: string | null
): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}/transcripts`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ raw_text: rawText, lang_hint: langHint }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save transcript: ${res.statusText}`);
  }
}

// ── Audio Transcription (Gnani.ai) ───────────────────────────────────────────

export async function transcribeAudio(
  audioBlob: Blob,
  languageCode = "mixed",
  token?: string | null
): Promise<{ text: string; detected_lang: string }> {
  const formData = new FormData();
  formData.append("file", audioBlob, "dictation.wav");
  formData.append("language_code", languageCode);

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/v1/audio/transcribe`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`STT Transcription failed: ${res.statusText}`);
  }
  return res.json();
}

// ── SSE Stream Reader Helper ──────────────────────────────────────────────────

export async function readSSEStream(
  url: string,
  token: string | null | undefined,
  body: Record<string, unknown> | null,
  headersExtra: Record<string, string> = {},
  onEvent: (event: string, data: Record<string, unknown>) => void
): Promise<void> {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    ...headersExtra,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Streaming request failed: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body readable from SSE stream");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const chunk of lines) {
      if (!chunk.trim()) continue;
      let eventType = "message";
      let eventData: Record<string, unknown> = {};

      const rawLines = chunk.split("\n");
      for (const line of rawLines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          try {
            eventData = JSON.parse(line.slice(5).trim());
          } catch {
            eventData = { raw: line.slice(5).trim() };
          }
        }
      }
      onEvent(eventType, eventData);
    }
  }
}

// ── Answers & Compilation ─────────────────────────────────────────────────────

export async function submitAnswers(
  sessionId: string,
  answers: Array<{ question_id: string; answer_text: string }>,
  token?: string | null
): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}/answers`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    throw new Error(`Failed to submit answers: ${res.statusText}`);
  }
}

export async function fetchLatestSpec(
  sessionId: string,
  token?: string | null
): Promise<SpecVersion | null> {
  const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}/spec`, {
    headers: getHeaders(token),
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch spec: ${res.statusText}`);
  }
  return res.json();
}
