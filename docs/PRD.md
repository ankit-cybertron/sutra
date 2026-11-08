# Product Requirements: VoxSpec

## 1. Problem

Solo developers and small teams who build with AI coding agents think out loud. Their ideas arrive as rambles: false starts, "no, actually", mixed languages, half-decided scope. Pasting that into an agent produces drifting, over-built, or wrong software. Writing a proper spec by hand is the chore they are trying to avoid.

## 2. Narrow user

**Primary:** a solo developer or student-founder in India (and globally) who dictates ideas (Wispr Flow or similar), builds with an AI coding agent, and has no PM. Often thinks in Hinglish.

**Not for:** enterprise product orgs, non-technical users wanting a no-code builder, anyone needing Jira-style workflow management.

## 3. Core loop

1. **Talk.** Dictate or paste a ramble (up to 12,000 characters).
2. **See your intent.** VoxSpec shows the *final intent* it extracted and a revision trace of what you changed your mind about.
3. **Close the gaps.** Answer up to 3 high-impact questions; unanswered gaps become visible assumptions.
4. **Hand off.** Compile a versioned spec and export an agent bundle.

Success moment: the user reads the extracted final intent and says "yes, that's exactly what I meant, including the part I changed my mind on."

## 4. Goals and non-goals

Goals
- G1: Final-intent extraction measurably better than a single-prompt baseline (see `docs/EVAL.md`).
- G2: Spec is strict enough that a coding agent can start without further questions.
- G3: Professional, calm, fast UI with a distinct identity from Spec Whisper.
- G4: Works well on English, Hindi, and Hinglish input.

Non-goals (v1)
- Team collaboration, comments, real-time multiplayer.
- Running or deploying the generated app.
- Native mobile apps.
- Billing.
- Recording or storing audio (text only in v1).

## 5. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| F1 | Authenticated workspace (email magic link + GitHub/Google OAuth via Supabase) | P0 |
| F2 | Projects containing sessions; sessions contain transcripts | P0 |
| F3 | Dictation workspace: large text surface, word/char counter (max 12,000), paste, sample ramblers, language hint | P0 |
| F4 | Analyze: stream stage progress; show final intent, revision trace, assumptions, <=3 questions | P0 |
| F5 | Answer questions (free text or suggested options), up to 2 rounds | P0 |
| F6 | Compile: produce a spec version validated against the schema | P0 |
| F7 | Spec viewer: sectioned, copyable per section, readiness score with breakdown | P0 |
| F8 | Export: `SPEC.md`, first-prompt copy button, ZIP agent bundle with per-agent variants | P0 |
| F9 | Version history and structural diff between versions | P1 |
| F10 | Revision trace visualization ("what changed your mind") | P0 (differentiator) |
| F11 | Assumption ledger: confirm / reject assumptions, which feeds recompile | P1 |
| F12 | Browser speech-to-text button (optional, progressive enhancement) | P2 |
| F13 | Dark/light theme, keyboard shortcuts (`Cmd/Ctrl+Enter` analyze) | P0 |
| F14 | Delete project and all data (privacy) | P0 |
| F15 | Public read-only share link for a spec (opt-in, revocable) | P2 |

## 6. Non-functional requirements

- Performance budgets in `ARCHITECTURE.md` section 10.
- Security and privacy per `docs/SECURITY.md`. Transcripts are private by default.
- Accessibility WCAG 2.2 AA.
- Availability target 99.5% (hobby-grade), graceful degradation if LLM provider is down (clear error, input preserved).
- Browser support: last 2 versions of Chrome, Safari, Firefox, Edge.

## 7. Spec output (the product)

Nine sections, fixed order, defined in `docs/SPEC_SCHEMA.md`:
Problem and narrow user, Core loop, Scope and cut line, User stories, Data model, Screens and states, Edge cases, Acceptance criteria, First agent prompt.

Plus metadata: readiness score and breakdown, decisions with revision trace, assumptions with risk, open questions.

## 8. Scope and cut line

**Must ship (demo slice, 48 hours):** F1 (magic link only), F2, F3, F4, F5, F6, F7, F8 (md + copy prompt), F10, F13, F14, eval harness with at least 25 golden transcripts and a baseline comparison.

**Next:** F8 ZIP bundle, F9, F11, OAuth.

**Later:** F12, F15, sharing, team features.

**Cut line rule:** if time runs short, drop from the bottom of the Must list upward. Never drop F10 or the eval harness: they are the differentiator.

## 9. Metrics

- **Final-Intent Accuracy (FIA)** on golden set (primary quality metric).
- **Revision Recall** and **Spurious Revision Rate**.
- Time from paste to compiled spec (p50).
- Spec acceptance proxy: percent of compiled specs exported.
- Zero critical findings in security review.

## 10. Risks and open questions

- Which LLM provider and model for default? Decide via benchmark in Phase 6, keep adapter swappable.
- Hinglish marker lexicon completeness. Mitigation: grow the lexicon from the golden set.
- Free-tier LLM rate limits during demo. Mitigation: `fake` provider demo mode plus cached sample outputs.
