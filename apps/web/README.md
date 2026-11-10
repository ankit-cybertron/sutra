# Sutra UI

Single-page, no-auth React frontend for a voice-first "idea to plan" app (Hindi / Hinglish / English). It is **UI only** and runs fully offline on a built-in mock API, so it can be demoed now and merged with the real backend later.

## Run

```bash
npm install
npm run dev          # http://localhost:5173, mock API by default (VITE_USE_MOCK=true)
npm run typecheck
npm run build        # outputs dist/
```

Dev flags (mock mode only): `?mock=ratelimit`, `?mock=blocked`, `?mock=down`, `?mock=slow`. Typing "ignore previous instructions..." demonstrates the guardrail message.

## What is on the page

One page, no routing, no login:

1. Hero: big idea box, mic orb (voice auto-activates after a one-time "Allow microphone"), char counter, CTA.
2. Clarify: 1 or 2 questions, shown and spoken aloud, answered by voice or text ("skip" / "chhodo", "done" / "bas").
3. Plan: bordered mono plan card (goal, must-haves with acceptance criteria, later, out of scope, build order, risks, first prompt) with Copy Markdown / Copy prompt / Download.
4. **Talk to the plan**: chat panel beside the plan, by voice (auto-sends when you stop speaking) or text, plus 3 suggestion chips. Every change creates a new version and a "what changed" box.
5. Static sections: How it works, Examples (BrainGrid-style idea -> questions -> plan demo that works with no backend), Features, footer.

UI languages: English, Hindi (Devanagari), Hinglish. The UI adopts the language detected from the first idea unless the user picked one.

## Merging with the backend

1. Read `docs/API_CONTRACT.md`. Implement those endpoints (they are small), including the **guardrails** and **rate limits** section. The UI already shows the right states for `RATE_LIMITED` (countdown), `INPUT_BLOCKED`, `INPUT_TOO_LONG`, `PROVIDER_UNAVAILABLE`, `VOICE_UNAVAILABLE`.
2. Set `VITE_USE_MOCK=false`. `vite.config.ts` proxies `/api` and `/ws` to `http://localhost:8000` (override with `VITE_DEV_BACKEND`). In production serve the built `dist/` from the same origin (FastAPI `StaticFiles`) so no CORS is needed.
3. Voice: the browser streams 16 kHz PCM16 (1024-byte frames, via `public/pcm-worklet.js`) to **your** `/ws/stt`, which relays to Gnani realtime STT. Spoken replies come from `POST /api/tts` (Gnani Timbre). In mock mode the browser's own SpeechRecognition / speechSynthesis stand in.
4. Run `docs/UI_PARITY.md` against the live reference and tune the CSS variables.

## Structure

```
src/
  App.tsx                 flow state machine: idle -> clarifying -> generating -> plan
  api/                    types (contract), http client, mock, error mapping
  voice/                  gnaniEngine (WS), webSpeechEngine (mock), useVoice, useSpeaker
  components/             Hero, ClarifyPanel, GeneratingPanel, PlanCard, ChatPanel, VoiceOrb, MicGate, Notice, ...
  lib/                    config, i18n (en/hi/hinglish), phrases (voice commands), sanitize, markdown, device
  styles/global.css       design tokens + all styles (plain CSS, no framework)
```

Dependencies are intentionally tiny: `react`, `react-dom` at runtime. Plain CSS, no UI kit. To rename the product edit `src/brand.ts`.

## Security notes for the UI

- All model text is rendered as React text nodes (no `dangerouslySetInnerHTML`, no Markdown-to-HTML).
- Client checks (length caps, invisible-character stripping, double-submit guard) are UX only. The backend is the authority for guardrails and rate limits.
- No API keys exist in this bundle. Self-host the fonts for production and set a strict CSP (`connect-src 'self'`, `media-src 'self' blob:`, `worker-src 'self'`, fonts from `'self'`).
- Mic audio is streamed for transcription and never stored by the UI.

## Known limits

- `@types/react` and Vite are not installed in the environment this was built in; the project was type-checked with a stub and run in Chromium through an esbuild bundle. Run `npm install && npm run typecheck && npm run build` first and fix any version drift (Vite and plugin-react versions in `package.json` may need a bump).
- Real-microphone behaviour (Gnani WebSocket path, barge-in, echo) has not been tested here; it needs a real key and a real mic.
- Hindi glyphs render correctly only when the Noto Sans Devanagari web font loads.
