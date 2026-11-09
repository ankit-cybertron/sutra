# Great Indian AI Internship Challenge — Submission Pack

## 1. Project Explanation (<= 250 words)

**Sutra** is a voice-first idea-to-plan engine crafted for solo builders, hackathon hackers, and students across India who brainstorm and think out loud in Hindi, Hinglish, and English. 

Most software specification tools are built around rigid, text-heavy input forms that disrupt natural brainstorming flow. When speaking out loud, builders communicate in fluid code-mixed Hinglish—mixing Hindi syntax with English technical vocabulary ("ek app chahiye jisme voice-first plan ban sake with dark mode").

Sutra solves this through an auto-activated voice loop:
1. **Instant Voice Intake:** As the builder speaks, Gnani Prisma v3 transcribes audio in real-time, streaming words directly into the workspace.
2. **Targeted Voice Clarification:** Instead of 20 tedious questions, Sutra identifies the core architecture ambiguity and asks back exactly 1 or 2 high-impact questions, spoken aloud via Gnani Timbre v2.5.
3. **Structured Blueprint Synthesis:** Powered by Groq, Sutra distills the conversation into an engineering vertical slice: <=5 core must-haves, strict build order, risk boundaries, and a ready-to-paste AI coding agent prompt.
4. **Voice Iteration:** Builders refine plans by simply talking ("dark mode bhi add karo"), creating versioned blueprints with instant diff summaries.

Audio is processed securely in memory without recording user voice files, keeping developer brainstorms completely private.

---

## 2. Gnani AI Usage Details

- **Prisma v3.0 (Speech-to-Text):**
  - **Realtime WebSocket (`/ws/stt`):** Bridges 16kHz PCM16 binary audio frames directly to `wss://api.vachana.ai/stt/v3/stream`, supporting live streaming transcription and automatic Indic code-mixed language detection (`indic-auto`).
  - **REST Fallback (`/api/stt`):** Handles audio file uploads (`/stt/v3`) for environments with restricted WebSocket connectivity.
- **Timbre v2.5 (Text-to-Speech):**
  - Synthesizes clarifying questions and feedback aloud in natural Indian accents (`Nalini`, `hi-IN` and `en-IN`) via `POST /api/v1/tts/inference`.
  - Implements SHA-256 disk caching to maximize credit efficiency.

*Note: Evon is not exposed on the Gnani API platform and is not utilized; reasoning and structured blueprint extraction are executed via Groq.*

---

## 3. 60-Second Demo Video Script

| Timestamp | Screen / Visual | Voiceover / Action (Speaker) |
|---|---|---|
| **00:00 - 00:08** | Sutra landing page, dark mode dot-grid hero. Auto-mic activates. | *"Say the idea. Skip the rambling. Meet Sutra—the voice-first plan engine for Indian builders."* |
| **00:08 - 00:20** | User speaks Hinglish idea: *"Yaar mujhe ek voice note app banana hai jo hackathons ke ideas ko seedha tech spec bana de."* | Realtime transcript streams live into the idea box via Gnani Prisma v3. |
| **00:20 - 00:32** | Question card appears: *"Target audience kaun hai - solo builders ya enterprise teams?"* | Gnani Timbre v2.5 speaks the question aloud. User taps or speaks: *"Solo developers and students."* |
| **00:32 - 00:44** | Plan generation card synthesizes in seconds. | 3 must-have cards, build order, and architectural notes appear cleanly. |
| **00:44 - 00:52** | User clicks microphone on suggestion panel and speaks: *"Dark mode aur export bhi add karo."* | Version 2 is generated; diff summary displays what was added. |
| **00:52 - 01:00** | User clicks **"Copy Agent Prompt"** and exports `.md`. | *"One click copies the entire blueprint as a coding agent prompt. Talk in Hinglish, ship in minutes."* |

---

## 4. Social Media Post Drafts

### LinkedIn Post Draft
> Excited to submit **Sutra** for the #GreatIndianAIInternshipChallenge hosted by @Gnani AI! 🚀
>
> Indian builders think and brainstorm out loud in Hinglish, yet traditional specification and planning tools force us into rigid English text forms.
>
> With **Sutra**, you just talk. Powered by Gnani AI's Prisma v3 (STT) and Timbre v2.5 (TTS) alongside Groq:
> 🎙️ Real-time voice-first idea intake (Hinglish, Hindi, English)
> ❓ Zero fluff: asks back exactly 1 or 2 clarifying architectural questions
> 📋 Generates a battle-tested MVP plan with <=5 must-haves, build order, and coding agent prompts
> ⚡ Voice-based iterative refinement ("dark mode bhi add karo")
>
> Check out our 60-second walkthrough and GitHub repo!
>
> #GnaniAI #GreatIndianAIInternshipChallenge #BuildInPublic #VoiceAI #HinglishAI

### X (Twitter) Post Draft
> Built **Sutra** for the @GnaniAI #GreatIndianAIInternshipChallenge! 🇮🇳🎙️
>
> Brainstorm your app idea in Hinglish, get back spoken clarifying questions via Gnani Timbre, and generate a scoped engineering plan + coding agent prompt in seconds.
>
> Real voice. Real Hinglish. Zero fluff.
> #GnaniAI #GreatIndianAIInternshipChallenge
