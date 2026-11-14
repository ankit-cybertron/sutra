import { createHttpApi } from "./http";
import { mockApi } from "./mock";
import type { Api } from "./types";

// Set VITE_SUTRA_API_BASE (e.g. https://api.sutra.dev) to talk to the real backend.
// Without it, the built-in demo engine runs fully in the browser.
const envBase = (import.meta.env["VITE_SUTRA_API_BASE"] as string | undefined)?.replace(/\/$/, "");
const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
export const isDemoMode = import.meta.env["VITE_USE_MOCK"] === "true";
// When running in production (CloudFront or Render), use same-origin relative URLs ("") to satisfy CSP
export const BASE = typeof window !== "undefined" && !isLocal ? "" : (envBase ?? "");
export const api: Api = isDemoMode ? mockApi : createHttpApi(BASE);
export * from "./types";
