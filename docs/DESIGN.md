# DESIGN.md

Visual and interaction system for VoxSpec. Goal: feel like a calm professional instrument, clearly different from Spec Whisper's editorial look. Use the `frontend-design` skill for craft decisions inside these constraints.

## 1. Identity

**Concept: "Studio console".** A quiet, precise workspace where speech becomes structure. Dark-first (light fully supported). Motion is minimal and meaningful: a live waveform-style input indicator while dictating, and a stage ribbon that fills as the pipeline runs.

Do **not** copy Spec Whisper's layout, copy, section numbering style ("01 / The ramble"), or palette.

## 2. Tokens

Define as CSS variables on `:root` and `[data-theme="dark"]`; Tailwind reads them. No raw hex in components. Values below are starting points; validate every text/background pair for WCAG 2.2 AA (4.5:1 body, 3:1 large text and UI) with a contrast checker before shipping and adjust.

| Token | Light | Dark |
|---|---|---|
| `--bg` | #F7F5F0 | #0E1117 |
| `--surface` | #FFFFFF | #151A23 |
| `--surface-2` | #F0EDE5 | #1B2230 |
| `--ink` | #16181D | #E8EAF0 |
| `--ink-muted` | #5B6070 | #9AA3B5 |
| `--line` | #E4E0D6 | #263042 |
| `--accent` | #B45309 | #F5A524 |
| `--accent-ink` | #FFFFFF | #1A1204 |
| `--ok` | #1F7A52 | #3DD68C |
| `--warn` | #9A6700 | #E3B341 |
| `--danger` | #B3261E | #FF7B72 |
| `--focus` | #1D4ED8 | #7AA2FF |

Radius: 6 / 10 / 16 px. Spacing scale 4px base. Shadows: one soft elevation only; borders carry most structure.

## 3. Typography

- UI: **Geist Sans** (fallback system-ui).
- Reading (spec document body, final-intent summary): **Newsreader** (serif) at 17-18px, line-height 1.65, measure 62-72ch.
- Code, IDs, offsets: **JetBrains Mono**.
- Scale: 12 / 14 / 16 / 18 / 22 / 28 / 40. Tight tracking on display sizes only.
- Self-host fonts via `next/font`. No layout shift.

## 4. Layout

Three-pane workspace (desktop >= 1200px):

```
+-----------+------------------------------+----------------------+
| Projects  |  Center: Dictation / Spec    |  Intent panel        |
| rail      |                              |  - Final intent      |
| (240px)   |                              |  - Revision trace    |
|           |                              |  - Assumptions       |
|           |                              |  - Questions (<=3)   |
+-----------+------------------------------+----------------------+
```

- 768-1199px: rail collapses to icons, intent panel becomes a drawer.
- <768px: single column with bottom tab bar (Talk / Intent / Spec).
- Top bar: breadcrumb, stage ribbon (Talk -> Intent -> Gaps -> Spec -> Export), theme toggle, user menu.

## 5. Key screens and states

Every screen defines empty, loading, error, and success states.

1. **Landing** (public): one-line value prop, animated before/after (messy ramble -> clean intent), CTA, honest "how it works" in 3 steps, link to benchmark results.
2. **Auth**: magic-link form, clear sent/expired/error states.
3. **Projects**: list with last-updated, readiness chip of latest version, "New project".
4. **Workspace / Talk**: large text surface (min 16 lines), live word and char counter against 12,000, language hint select, sample rambles menu, primary action "Extract intent" (`Cmd/Ctrl+Enter`). While running: stage ribbon animates with per-stage timing. Never block the textarea after an error; input is preserved.
5. **Intent panel**:
   - *Final intent* card: summary sentence plus decision list, each decision showing its final value.
   - *Revision trace* ("What changed your mind"): per topic, a horizontal chain `A ~~struck~~ -> B ~~struck~~ -> C (final)`; hover or focus highlights the evidence span in the transcript, clicking scrolls the transcript to it. This is the signature interaction.
   - *Assumptions*: chips with risk color plus text label (never color alone); confirm / reject controls.
   - *Questions*: up to 3 cards, each with "why it matters", suggested option buttons, free text; "Skip, keep as assumption".
6. **Spec viewer**: sticky section nav (9 sections), serif reading column, per-section copy button, readiness ring with expandable breakdown, version switcher, diff mode (added green, removed red, both with +/- glyphs).
7. **Export dialog**: tabs `Copy first prompt`, `Download SPEC.md`, `Agent bundle (ZIP)` with agent selector (Antigravity / Claude Code / Cursor).
8. **Settings**: theme, language default, delete all data (typed confirmation).

## 6. Interaction rules

- Keyboard: every action reachable; visible 2px focus ring using `--focus`; skip-to-content link; logical tab order; `Esc` closes dialogs; shortcuts discoverable via `?`.
- Motion: 150-250ms, ease-out; honor `prefers-reduced-motion` (replace animation with instant state change).
- Streaming: render stage events as they arrive; show partial results only when schema-valid.
- Copy buttons confirm with text change ("Copied") and an `aria-live="polite"` announcement.
- Errors: plain language, what happened, what to do, retry button, request id in a collapsed details element.

## 7. Content voice

Direct, specific, no hype. Examples: "Extract intent", "3 things changed while you spoke", "2 assumptions need your call". Avoid "magic", "supercharge", emoji in UI chrome.

## 8. Accessibility checklist

- Landmarks and headings in order; one `h1` per page.
- Form fields labelled; errors linked with `aria-describedby`.
- Readiness ring and trace have text equivalents.
- Tested at 200% zoom and 320px width.
- Automated axe pass in Playwright on every main screen, zero serious violations.

## 9. Evidence

Capture screenshots for each screen in light, dark, desktop, and mobile into `docs/evidence/ui/` as part of Phase 4 and 5 verification.
