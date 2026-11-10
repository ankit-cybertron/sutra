# Voice Architecture & Language Handling (`VOICE.md`)

## 1. Overview
Sutra is designed for solo builders and students in India who brainstorm and think out loud in Hindi, Hinglish, and English. The voice system connects **Gnani AI** for speech recognition (STT) and speech synthesis (TTS) with a single-origin WebSocket relay and client-side AudioWorklet streaming.

---

## 2. Speech-to-Text (STT) - Gnani Prisma v3.0

### Realtime Stream (`WS /ws/stt`)
- **Architecture:** The browser communicates exclusively with Sutra's backend (`WS /ws/stt`), which proxies to Gnani Prisma upstream. Gnani API keys never leave the server.
- **Audio Capture:** Browser captures 16 kHz PCM signed 16-bit LE mono audio in exact 1024-byte frames (512 samples = 32ms) via `pcm-worklet.js`.
- **Pre-Roll Burst Handling:** On speech onset (detected by client RMS energy exceeding adaptive noise floor for ~96ms), the client connects to `/ws/stt` and flushes 10 frames (~320ms) of pre-roll audio so the very first syllable is captured accurately.
- **Turn Lifecycle & Wire Protocol:**
  1. Client sends binary frames of 1024 bytes.
  2. Server streams back JSON transcript events:
     ```json
     { "type": "transcript", "text": "Mujhe ek app chahiye", "segmentId": 1, "lang": "hinglish" }
     ```
  3. After ~1.2s of silence (or 45s maximum turn length), client sends `{"type": "commit"}`.
  4. Server flushes final transcript, emits `{"type": "done"}`, and closes the WebSocket connection.
- **Security & Limits:**
  - Origin verification (`Origin` header checked against allowed host/localhost).
  - Concurrency control: Maximum 1 concurrent voice stream per device/IP. If busy, server responds with `{"type": "error", "code": "BUSY", "message": "..."}` and closes with code 1008.
  - Idle timeout: 15s disconnection.
  - Maximum turn duration: 45s hard cutoff.

### REST Fallback (`POST /api/stt`)
- For devices or network environments blocking WebSocket traffic, audio can be submitted via standard multipart upload.

### Code-Mixing & Hinglish Handling
- Gnani Prisma v3.0 running with `language_code="indic-auto"` provides smooth automatic code-mixing between English technical jargon ("API", "FastAPI", "React") and conversational Hindi ("bana do", "chahiye", "kaise karein").
- The detected language (`en`, `hi`, `hinglish`) dynamically drives prompt language and TTS synthesis.

---

## 3. Text-to-Speech (TTS) - Gnani Timbre v2.5

### Endpoint & Configuration
- **Backend Route:** `POST /api/tts`
- **Payload:** `{ "text": string, "lang": "en" | "hi" | "hinglish" }` (capped at 240 characters)
- **Response:** Binary audio (`audio/mpeg` or `audio/wav`), playable directly via HTML5 Audio / Blob URL.
- **Voice Mapping:**
  - Hindi & Hinglish: `Nalini` (`hi-IN`)
  - English: `Nalini` (`en-IN`)

### Caching & Credit Discipline
- **Server Disk Cache:** Audio is indexed by `sha256(text + voice + lang)` in `data/tts-cache/`.
- **Cache Hit Speed:** < 1ms response with HTTP 200 and `Cache-Control: public, max-age=86400`.
- **Strict Bounds:** Text inputs > 240 chars are rejected with HTTP 413 `INPUT_TOO_LONG`.

---

## 4. Turn-Taking, Echo Prevention & Barge-In
- **Echo Prevention:** Microphone uplink is paused during TTS audio playback so spoken audio is not recaptured.
- **Barge-In:** If the user speaks firmly during TTS playback (client RMS exceeding 6x noise floor for > 250ms), audio playback is immediately halted and listening reactivates.
- **Error Fallback:** If mic access is denied or unsupported, voice controls gracefully disable while full text typing and keyboard navigation remain 100% functional.
