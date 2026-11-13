---
name: Sutra Design System
description: Chunky, tactile, editorial design language for voice-to-spec developer tooling
colors:
  paper-carnival: "oklch(93.5% 0.038 55)"
  ink-carnival: "oklch(18% 0.065 25)"
  paper-brutal: "oklch(97.5% 0.006 95)"
  ink-brutal: "oklch(10% 0.006 95)"
  paper-sticker: "oklch(96% 0.012 85)"
  accent-sticker: "oklch(62% 0.24 350)"
  paper-werkstatt: "oklch(86% 0.022 80)"
  ink-werkstatt: "oklch(17% 0.008 60)"
  paper-dark: "oklch(10% 0.005 240)"
  ink-dark: "oklch(98% 0.005 240)"
typography:
  display-carnival:
    fontFamily: "'Big Shoulders Display', Impact, sans-serif"
    fontWeight: 800
    letterSpacing: "0.015em"
  display-brutal:
    fontFamily: "'Libre Franklin', sans-serif"
    fontWeight: 900
    letterSpacing: "-0.03em"
  display-sticker:
    fontFamily: "'Gabarito', sans-serif"
    fontWeight: 900
    letterSpacing: "-0.02em"
  display-werkstatt:
    fontFamily: "'Jost', sans-serif"
    fontWeight: 800
    letterSpacing: "0.04em"
  body-default:
    fontFamily: "'Golos Text', system-ui, sans-serif"
    lineHeight: 1.55
  mono:
    fontFamily: "'JetBrains Mono', monospace"
rounded:
  sm: "2px"
  card: "4px"
  lg: "6px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
---

# Design System

## Overview
Sutra's visual identity rejects generic, templated AI SaaS aesthetics (such as purple gradient glows, floating cards with soft 20px blur shadows, and empty decorative blobs). Instead, Sutra draws inspiration from tactile printmaking, editorial broadsheets, and industrial workshops. The interface feels solid, physical, responsive, and handcrafted.

## Colors
Color in Sutra is driven by five distinct visual worlds accessible via the live theme switcher:
1. **Carnival (Default Light):** Warm newsprint stock (`oklch(93.5% 0.038 55)`), intense black-ink rules (`oklch(18% 0.065 25)`), and energetic mustard accents (`oklch(84% 0.18 85)`).
2. **Brutal:** High-contrast pure poster stock (`oklch(97.5% 0.006 95)`), stark 3px borders, and an acid-yellow highlight pill (`oklch(90% 0.19 105)`).
3. **Sticker:** Die-cut physicality with vivid magenta accents (`oklch(62% 0.24 350)`), 18px rounded card geometry, and 5px hard offset ink shadows.
4. **Werkstatt:** Bauhaus workshop utility on warm putty paper (`oklch(86% 0.022 80)`), ultramarine accents (`oklch(48% 0.21 260)`), and architectural grid rules.
5. **Dark Mode:** Deep midnight canvas (`oklch(10% 0.005 240)`) with crisp high-contrast off-white text and restrained ambient depth.

## Typography
Typography is an active storytelling element, not a neutral vehicle:
- **Display Headings:** Big Shoulders Display (condensed, physical punch), Libre Franklin (heavy brutalist weight), Gabarito (chunky rounded geometries), or Jost (Bauhaus geometric structure).
- **Body:** Golos Text, Sofia Sans, and Karla. Set with line lengths under 75ch and minimum 4.5:1 WCAG AA contrast.
- **Data & Specs:** JetBrains Mono for blueprint outputs, character counts, and terminal-style metadata tags.

## Layout
- Grid is locked to an exact 4px rhythm (`--space-3xs: 2px`, `--space-xs: 8px`, `--space-md: 16px`, `--space-lg: 24px`, `--space-xl: 40px`).
- Maximum container width is unified at `1440px`.
- Consistent gutters (`64px` on desktop, `24px` on tablet, `16px` on mobile).
- Asymmetrical layouts for feature comparison and split workspace view (clarify interview on left, live blueprint on right).

## Elevation & Depth
- **No Soft Gray AI Blurs:** Drop shadows are hard-edged physical ink drops (`4px 4px 0px var(--color-ink)`).
- **Emil Kowalski Button Physics:**
  - Resting: `transform: none; box-shadow: var(--shadow-btn);`
  - Hover: `transform: translate(-1px, -1px);`
  - Active Press: `transform: translate(2px, 2px); box-shadow: none;`
- Inset feedback confirms the user's action with instant responsiveness.

## Shapes
- **Theme-Responsive Geometry:**
  - Carnival: 4px card radius, 2.5px solid borders.
  - Brutal & Werkstatt: 0px radius (sharp crisp corners), 3px/2.5px solid black rules.
  - Sticker: 18px card radius, die-cut silhouette, 999px pills.
  - Dark: 8px card radius, subtle hairline borders.

## Components
- **Buttons (`.btn`):** High-contrast interactive elements with tactile state feedback and bold labels.
- **Voice Orb (`.orb`):** Real-time acoustic feedback with composite-only CSS bar animations (`transform: scaleY()`).
- **Plan Cards (`.plan`):** Engineering blueprint cards featuring sticky terminal headers, version badges, copy/download triggers, and syntax-highlighted markdown.
- **Architecture Diagram Viewport (`.arch-result-card`):** Interactive SVG viewer with pan/zoom, model attribution tag, and download triggers.
- **Theme Selector (`.theme-select`):** Sticky, immediate theme switcher in the global navigation.

## Do's and Don'ts
- **DO:**
  - Use tokens (`var(--color-paper)`, `var(--color-ink)`, `var(--border-w)`) exclusively for styling.
  - Specify explicit transition properties (`transform`, `opacity`, `background-color`, `border-color`, `box-shadow`) instead of `transition: all`.
  - Use composite-only properties for animations to ensure 60fps performance.
  - Ensure all clickable items have `cursor: pointer` and clear focus rings (`:focus-visible`).
- **DON'T:**
  - Never add blue-purple SaaS gradient blobs or generic glassmorphism backdrops.
  - Never use emoji icons in place of accessible SVG icons.
  - Never invent fake customer testimonials or unverified metrics.
  - Never push commits to the remote repository.
