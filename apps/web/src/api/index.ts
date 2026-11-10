import { USE_MOCK } from "../lib/config";
import { httpApi } from "./client";
import { mockApi } from "./mock";
import type { Api } from "./types";

export const api: Api = USE_MOCK ? mockApi : httpApi;
export * from "./types";
export { ApiError, toApiError } from "./errors";
export type { ApiErrorCode } from "./errors";
