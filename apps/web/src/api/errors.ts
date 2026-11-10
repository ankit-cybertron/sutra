export type ApiErrorCode =
  | "RATE_LIMITED" // 429, includes retryAfter seconds
  | "INPUT_BLOCKED" // 422, guardrails rejected the input (injection, abuse, off-topic, unsafe)
  | "INPUT_TOO_LONG" // 413
  | "INPUT_INVALID" // 422, empty or malformed
  | "PROVIDER_UNAVAILABLE" // 502/503, LLM or voice provider down
  | "VOICE_UNAVAILABLE" // voice provider failed, text still works
  | "NOT_FOUND" // 404
  | "NETWORK" // client could not reach the server
  | "INTERNAL";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string,
    public retryAfter?: number,
    public requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof DOMException && e.name === "AbortError") {
    return new ApiError(0, "NETWORK", "The request timed out.");
  }
  if (e instanceof TypeError) {
    return new ApiError(0, "NETWORK", "Could not reach the server.");
  }
  return new ApiError(500, "INTERNAL", e instanceof Error ? e.message : "Unexpected error.");
}
