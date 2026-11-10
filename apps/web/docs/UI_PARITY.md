# UI parity checklist

Goal: the shell matches the look and layout of the reference screenshots (dark, minimal, large two-line hero, bordered idea box with a counter, white pill button, 2-column feature rows, mono plan card). Sutra keeps its own name, wordmark, copy and icons.

The numbers below are **estimates** read from screenshots that look like a ~1440px viewport scaled ~1.4x. The tokens live in `src/styles/global.css`. Before sign-off, measure the live reference with Playwright at 1440x900 and 390x844 (`getComputedStyle` and `getBoundingClientRect`) and update the CSS variables to match.

| Item | Current value | Reference estimate | Measured on reference | Done |
|---|---|---|---|---|
| Nav height | 64px | ~64px | | |
| Nav container | 1200px | ~1200px | | |
| H1 size / weight / tracking | 72px / 800 / -0.04em | ~72px / 800 / tight | | |
| H1 line 2 | italic, #6a6a74 | italic, heavily dimmed gray | | |
| Hero sub | 19px, #b4b4bc | ~19px muted | | |
| Idea box width / min height | 660px / 104px + footer row | ~660 x ~125px | | |
| Idea box radius / border | 8px / 1px #1f1f23 | ~8px / dark 1px | | |
| Counter | mono 12px, bottom-right | "0/1000" bottom-right | | |
| CTA size / fill | 320 x 48, #f2f2f3 | ~320 x ~47, light fill, dark text | | |
| Disabled CTA | #8d8d90 | mid-gray | | |
| Hero dot grid | 24px pitch, #1c1c20, masked | faint dots | | |
| Feature row columns | 280px + 1fr, container 880px | ~880px container | | |
| Feature icon tile | 40px, 8px radius | ~40px | | |
| Feature H2 | 24px / 700 | ~24px | | |
| Feature copy | 16px / 1.6; detail 14px with 1px left rule | ~15px; dim detail with left rule | | |
| Plan card | mono 13.5px, 1.5px border, header bar with status dot | mono, dark card, header bar with dot | | |

Intentional deviations (documented): second hero line is `#6a6a74` instead of the reference's dimmer gray so it passes WCAG 3:1 for large text; fonts are Inter / JetBrains Mono / Noto Sans Devanagari (the reference's exact families should be read from its computed styles).

Visual QA at 1440, 1024, 768 and 390 widths. No horizontal scroll at 390 (verified).
