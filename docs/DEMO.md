# VoxSpec 3-Minute Live Demo Script & Walkthrough

This document outlines the exact demo script for the VoxSpec vertical slice.

---

## 1. Persona & Pitch (0:00 - 0:30)

> "Every engineer knows the pain of talking through a software architecture idea. You ramble, change your mind mid-sentence, mix Hindi and English, retract half-baked ideas, and leave edge cases open. If you hand that disfluent audio transcript directly to an AI coding agent, it hallucinates or builds the superseded feature.
> 
> **VoxSpec** solves this with **Intent Convergence**. You speak the messy idea, our Indic-aware pipeline strips disfluencies, tracks revision lineage in real time, deterministically scores readiness, and outputs a validated, version-controlled build specification ready for Antigravity, Claude Code, or Cursor."

---

## 2. Walkthrough Steps (0:30 - 2:15)

### Step 1: Projects Console & Dictation Workspace
1. Navigate to `http://localhost:3000/projects`.
2. Click **"+ New Project"** and name it `QuickCommerce Darkstore Scanner`.
3. Enter the project session. Notice the 3-pane Studio Console layout:
   - **Left Pane:** Voice recorder and ramble editor (with 12,000 char cap).
   - **Center Pane:** Real-time Intent & Revision panel.
   - **Right Pane:** Live Spec preview & readiness score gauge.

### Step 2: Indic Code-Mixed Dictation (Hinglish)
1. Select language `Hinglish (Roman)` or click **"QuickCommerce Darkstore"** in the sample prompt loader:
   > *"Ek quick commerce dark store inventory scanner banate hain. Store worker barcode scan karega to item count badhega. Agar barcode unreadable ho to manual search se item dhund sakte hain. Nahi actually manual search nahi chahiye, fraud ho sakta hai, camera OCR se expiry check karein. Maybe we can also give dark theme to workers, not sure though."*
2. Click **"Analyze Intent (Cmd+Enter)"** or record via microphone (powered by Gnani.ai Indic STT).
3. Watch the **Stage Ribbon** transition live via Server-Sent Events (SSE):
   - `normalize` (NFC Unicode, Indic token classification)
   - `extract` (Groq LPU high-speed structured extraction)
   - `resolve` (Deterministic conflict resolver, zero LLM vibes)
   - `gaps` (Targeted ambiguity detection)

### Step 3: Signature Feature — The Revision Trace
1. In the Center Pane, observe the **Revision Trace ("What changed your mind")**:
   - `manual search se item dhund sakte hain` ~~superseded~~ $\rightarrow$ `camera OCR for expiry check`
2. Hovering or clicking on the step node spotlights the exact character span in the original transcript.
3. Observe how the tentative claim *"dark theme for workers"* was automatically categorized under **Assumptions** rather than polluting core functional scope.

### Step 4: Clarifying Questions & Spec Compilation
1. Review the generated targeted question (max 3):
   - *"How should offline network drops in the dark store be handled?"*
2. Click **"Queue locally in SQLite and retry on reconnect"**.
3. Click **"Compile Spec"**.
4. The right pane reveals the compiled **SPEC.md** across all 9 standardized sections with a computed **Readiness Score (80+)** and detailed breakdown.
5. Click **"Copy First Prompt"** or **"Download SPEC.md"**.

---

## 3. The Research Benchmark: Intent Convergence (2:15 - 3:00)

1. Show the evaluation harness in terminal:
   ```bash
   apps/api/.venv/bin/python evals/runner.py
   ```
2. Explain the benchmark findings from `evals/reports/`:
   - Evaluated across **40 golden transcripts** (52.5% Indic Hinglish / Hindi).
   - **VoxSpec System S:** **100.0% Final-Intent Accuracy (FIA)** vs **95.4%** on single-prompt baseline (B0).
   - **Implicit Revision Resolution:** **+30.6% advantage** over single prompt (which consistently outputs superseded claims).
   - **Injection Resistance:** **100.0%** — malicious adversarial prompt injections inside spoken transcripts are safely sandboxed as untrusted data without escaping into spec decisions.

---

## 4. UI Evidence Screenshots

- Desktop Projects Console: `docs/evidence/ui/projects_desktop.png`
- Studio Dictation Workspace: `docs/evidence/ui/workspace_talk.png`
- Responsive Mobile Viewport: `docs/evidence/ui/workspace_mobile.png`
