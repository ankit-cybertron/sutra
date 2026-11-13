# Voice to Blueprint

I want you to redesign the whole website frontend https://github.com/ankit-cybertron/sutra
i want the fronted files only and it should have nice tech site like apple or gooole clean professnal but this very intractive and amazing

Ran find files in apps/web/src

Analyzed App.tsx:L1-100

Analyzed App.tsx:L101-250

Analyzed App.tsx:L440-583

Here is the complete functional ground of what was built, why it exists, and the exact screen-by-screen breakdown of all pages and actions for your frontend builder (without any styling or design references).

---

## 1. What We Built & The Core Purpose

### The Problem

When founders, product managers, and developers have an idea, speaking it out loud is 3x faster than typing. However, raw voice rambles are unstructured, disjointed, and miss critical technical edge cases. Traditional AI chat tools respond with generic bullet points that still require hours of manual PRD writing.

### What Sutra Does

Sutra is a **Voice-First Specification & Architecture Engine**. It takes raw, spoken rambles (in Indian English, Hindi, or Hinglish) and turns them into production-ready specifications, acceptance criteria, implementation task sequences, and interactive architecture diagrams.

---

## 2. Core User Journey Flow

```

[Screen 1: Idea Intake] ──► (Optional Clarify) ──► [Screen 2: Clarify Interview]

          │                                                   │

          ▼ (Direct Plan)                                     ▼ (Answers Submitted)

  [Screen 3: Generating State (3-5s)]

          │

          ▼

  [Screen 4: Plan Workspace] (Interactive PRD + Architecture Diagram + Refinement Chat)

```

---

## 3. The 4 Application Screens & Functional Requirements

### Screen 1: The Intake & Overview (`stage: "idle"`)

This is the home entry screen where users start their session and learn what the system does.

#### 1. Header / Global Navigation

- **Brand Logo & Name:** Resets to a clean state when clicked.

- **Language Switcher:** Toggle between English (`en`), Hindi (`hi`), or Hinglish (`hinglish`).

- **Connection Status Badges:** Real-time ping indicator showing whether the backend LLM (Groq) and Voice provider (Gnani.ai) are reachable.

- **"New Idea" Action:** Clears the current draft and starts fresh.

#### 2. Hero Input Module

- **Voice Orb (Microphone Button):**

  - Clicking triggers browser audio permission request.

  - While recording, displays live acoustic volume levels.

  - Supports **barge-in** (speaking automatically pauses any system text-to-speech audio).

  - Recognizes spoken voice commands: saying **"done"** submits the idea; saying **"skip"** skips a step.

- **Idea Text Area:**

  - Auto-updates in real time as the user speaks with a live streaming transcript preview.

  - Allows manual typing or editing at any time.

  - Character counter with warning indicators if length exceeds limits.

- **Sample Idea Chips:**

  - Quick-start one-click prompt pills (e.g., *"Doctor clinic slot booking on WhatsApp"*, *"Freelance invoice tracker with payment reminders"*).

- **Dual Action Buttons:**

  - **"Refine & Clarify" (Recommended):** Sends idea to generate 1–2 clarifying questions to resolve ambiguities before compiling.

  - **"Compile Directly":** Skips questions and immediately compiles the PRD.

#### 3. Overview & Product Walkthrough Sections

- **Interactive Demo Module:** A live interactive preview showcasing an example idea input, the generated clarifying questions, and the resulting plan card so users understand the output format before recording.

- **How It Works (3 Steps):** Explanation of the sequence: 1. Ramble idea -> 2. Clarify questions -> 3. Export Blueprint & Architecture.

- **Feature Breakdown:** Summary of capabilities (Indic voice capture, prompt-ready markdown exports, Groq compilation speed, local privacy).

- **FAQ Accordion:** Expandable answers for audio privacy, export formats, LLM model choice, and network latency.

- **Bottom CTA:** Floating voice trigger that scrolls back to top and activates the mic.

---

### Screen 2: Clarifying Interview (`stage: "clarifying"`)

If the user chooses "Refine & Clarify", the application enters this focused interview view.

#### Functional Requirements:

- **Idea Recap Box:** Displays the original ramble so the user remembers the context.

- **Progress Counter:** Shows current question progress (e.g., *"Question 1 of 2"*).

- **Spoken Text:** Reads the question aloud in the user's selected language using Gnani TTS.

- **Multiple-Choice Suggestion Chips:** The LLM generates 2–3 likely answers based on standard technical architecture. Clicking a chip instantly fills the answer.

- **Voice or Text Answer Input:** The user can speak their answer via the Voice Orb or type into the input field.

- **Actions:**

  - **"Next / Answer":** Saves the answer and advances to question 2.

  - **"Skip Question":** Leaves the ambiguity open and moves to the next question.

  - **"Skip All & Compile Now":** Bypasses any remaining questions and begins plan generation immediately.

---

### Screen 3: Generating Loading State (`stage: "generating"`)

Displayed while the backend runs the compilation prompt (typically 2 to 4 seconds).

#### Functional Requirements:

- Animated progress checklist illustrating what the backend is compiling:

  1. Parsing core requirements and user stories

  2. Defining acceptance criteria and edge cases

  3. Sequencing engineering build order

  4. Generating prompt-ready launch instructions

---

### Screen 4: The Plan Workspace (`stage: "plan"`)

Once generated, the screen transforms into an engineering cockpit with two side-by-side columns:

#### Left Column: The Plan Specification Document (`PlanCard`)

Displays the complete technical PRD:

1. **Plan Header:** Shows the Plan ID (e.g., `SUTRA-9F8`), revision version (starts at `v1`), and an automated **Readiness Score** badge (e.g., `94/100`).

2. **One-Liner & Problem Statement:** High-level executive summary and core problem being solved.

3. **Core Loop:** The primary 3-to-4-step user workflow sequence.

4. **Must-Have Features (Max 5):**

   - Each item includes the feature title, the **Why** rationale, and explicit bulleted **Acceptance Criteria**.

5. **Scope Boundaries:**

   - **Later:** Valuable features intentionally deferred to post-MVP.

   - **Out of Scope:** Features explicitly rejected to protect engineering timeline.

6. **Build Order:** Sequenced numbered implementation steps (Step 1, Step 2, Step 3) with architectural detail.

7. **Tech Architecture & Risks:** Recommended tech stack, dependencies, identified security/scaling risks, and open assumptions.

8. **Interactive Architecture Diagram Module:**

   - A **"Generate Architecture Diagram"** action button.

   - Calls the Gemini backend to synthesize Mermaid code.

   - Renders the resulting SVG diagram right inside the card.

   - Provides toolbar actions: **Zoom in/out**, **Copy Mermaid Code**, and **Download SVG**.

9. **Prompt-Ready Launch Block:** A pre-formatted prompt ready to copy and paste into Claude Code, Cursor, or Codex to immediately start scaffolding the code.

10. **Export Actions:**

    - **"Copy Markdown":** Copies the entire formatted PRD to the system clipboard.

    - **"Copy First Prompt":** Copies just the prompt-ready block.

    - **"Download .md":** Triggers file download of the full document (`<title>-v1.md`).

#### Right Column: Conversational Co-pilot (`ChatPanel`)

Allows iterative, conversational refinement of the plan:

1. **Chat Log:** History of user requests and assistant replies.

2. **Suggested Action Chips:** The plan generates 2–3 contextual suggestions (e.g., *"Add rate limiting to API"*, *"Include offline local caching"*). Clicking one immediately sends it to the chat.

3. **Voice & Text Input:** User can talk to the plan co-pilot or type adjustments.

4. **Text-to-Speech Toggle:** A checkbox/switch to enable or disable audio playback of AI replies.

5. **Live Plan Mutation:** When the assistant updates the plan:

   - It outputs an explanation in the chat.

   - It automatically updates the document in the Left Column.

   - Increments the version number (`v1` -> `v2`).

   - Appends a **Change Summary** banner showing exactly what lines were added, modified, or removed.

---

## 4. Key Frontend State Variables to Wire in Lovable

| State Property | Type | Purpose |

| :--- | :--- | :--- |

| `stage` | `"idle" \| "clarifying" \| "generating" \| "plan"` | Controls which main screen is visible. |

| `lang` | `"en" \| "hi" \| "hinglish"` | Selected language for UI strings and voice output. |

| `idea` | `string` | The text of the user's initial project ramble. |

| `sessionId` | `string \| null` | Current active intake session ID. |

| `questions` | `Array<Question>` | 1–2 clarifying questions returned by the backend. |

| `qIndex` | `number` | Index of the question currently being answered (0 or 1). |

| `answers` | `Array<{ questionId, text }>` | Collected user responses to questions. |

| `doc` | `PlanDoc \| null` | Full compiled PRD object (contains `plan`, `version`, `id`, `changeSummary`). |

| `messages` | `Array<ChatMessage>` | Conversation history in the refinement chat. |

| `voiceStatus` | `"off" \| "listening" \| "speaking" \| "processing"` | Live microphone / STT state. |

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e63d0e88-5068-535c-86e3-853f4ddf5234).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
