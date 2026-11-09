# Voice Architecture & Language Handling (`VOICE.md`)

## 1. Overview
Sutra is designed for solo builders and students in India who brainstorm and think out loud in Hindi, Hinglish, and English. The voice system connects **Gnani AI** for speech recognition (STT) and speech synthesis (TTS) with an asynchronous turn-taking loop.

## 2. Speech-to-Text (STT) - Gnani Prisma v3.0

### Realtime Stream (`WS /ws/stt`)
- **Upstream endpoint:** `wss://api.vachana.ai/stt/v3/stream`
- **Protocol:**
  - Client sends 1024-byte PCM16 mono frames sampled at 16 kHz (512 samples = 32ms per frame).
  - Upstream headers: `x-api-key-id`, `model: prisma-v3.0`, `language_code: indic-auto`, `x-sample-rate: 16000`.
  - Client ends turn with JSON `{"type": "commit"}`.
  - Server relays `transcript` events (`text`, `segment_id`, `detected_language_code`).
- **Security & Concurrency:**
  - Gnani API keys are strictly guarded server-side; browser connects to Sutra backend (`WS /ws/stt`), never directly to Gnani.
  - Device concurrency is capped at 1 active stream per device to avoid accidental concurrent streams.
  - Automatic turn cutoff enforced at 45 seconds.

### REST Fallback (`POST /api/stt`)
- For environments with restricted WebSocket connectivity or transient network drops.
- Accepts multipart form data with clips <= 30 seconds.

### Hinglish & Code-Mixing Analysis
- Prisma v3.0 with `language_code="indic-auto"` provides smooth automatic language detection between English, Hindi, and code-mixed Hinglish phrases.
- The `detected_language_code` is returned with every transcript event and dynamically propagates to downstream clarifying prompts and TTS voices.

## 3. Text-to-Speech (TTS) - Gnani Timbre v2.5

### Endpoint & Configuration
- **Endpoint:** `POST https://api.vachana.ai/api/v1/tts/inference`
- **Model:** `timbre-v2.5`
- **Voice Selection:**
  - Hindi / Hinglish: `Nalini` (`hi-IN`)
  - English: `Nalini` (`en-IN`)
- **Format:** `mp3` container, 24000 Hz, linear PCM.

### Credit Discipline & Latency Optimization
- **Disk Caching:** All synthesized audio is hashed by `sha256(text + voice + lang)` and cached in `data/tts-cache/<hash>.mp3`.
- **First Call Latency:** ~2.0s
- **Cached Call Latency:** <1ms
- **Length Caps:** Spoken question lines are capped at ~200-300 characters to conserve API credits.

## 4. Turn-Taking and Barge-In
- The microphone stream is paused during TTS playback to eliminate echo loopback.
- When the user starts speaking during TTS playback (barge-in detected via client RMS VAD), audio playback immediately halts and microphone listening reactivates.
