# Sutra 60-Second Cinematic Product Launch Reel

This repository contains the complete production pipeline, automated screen recordings, custom soundtrack synthesis, motion graphics, and final 9:16 vertical video renders for the **Sutra 60-Second Cinematic Product Launch Reel**.

---

## 📁 Project Directory Structure

```
.
├── output/
│   ├── Sutra_Launch_Reel_60s.mp4       # Master vertical 1080×1920 (9:16), 30fps, 60.00s H.264/AAC
│   ├── Sutra_Launch_Reel_Preview.mp4   # Fast-sharing 720×1280 (9:16), 30fps, 60.00s H.264/AAC
│   └── temp_segments/                  # Intermediate rendered scene blocks
├── recordings/                         # Raw 1080×1920 Playwright browser screen captures
│   ├── scene1_hero.webm                # Hero section, audio thread, rotating text, voice orb
│   ├── scene2_idea_input.webm          # Idea typing and Recommend action
│   ├── scene3_clarification.webm       # AI interactive clarification questions
│   ├── scene4_readiness_modal.webm     # 10-Factor readiness score assessment popover
│   ├── scene4_readiness_score.webm     # Blueprint generation and readiness badge
│   ├── scene5_reactflow_arch.webm      # React Flow interactive architecture canvas
│   └── scene6_copilot_chat.webm        # Plan Co-pilot AI interactive chat
├── music/
│   └── sutra_cinematic_percussion_60s.wav # Custom synthesized 60s percussion score (48kHz stereo)
├── assets/
│   ├── title_01_idea.png               # Title Card 01: "Every software empire..."
│   ├── title_02_reality.png            # Title Card 02: "Begins with a single spoken word."
│   ├── title_03_logo_reveal.png        # Title Card 03: Sutra brand insignia & subtitle
│   ├── title_06_final_brand.png        # Title Card 06: Grand Climax & CTA
│   ├── overlay_01_intake.png           # Transparent lower third: Speech-to-Concept
│   ├── overlay_02_clarify.png          # Transparent lower third: AI Clarification Engine
│   ├── overlay_03_readiness.png        # Transparent lower third: Dynamic Readiness Scoring
│   ├── overlay_04_arch.png             # Transparent lower third: Interactive Architecture
│   ├── overlay_05_copilot.png          # Transparent lower third: Plan Co-pilot AI
│   └── verify_frames/                  # Extracted frames at key seconds for QA
├── render_scripts/
│   ├── record_sutra_demo.js            # Automated Playwright recording of main user flow
│   ├── record_plan_features.js         # Automated Playwright recording of React Flow & Co-Pilot
│   ├── generate_cinematic_soundtrack.py# Mathematical synthesis of 60s Taiko/orchestral score
│   ├── generate_graphic_cards.js       # Playwright 2x Retina rendering of title & lower-third cards
│   └── assemble_reel.py                # Master FFmpeg compositing, speed ramps & audio sync
└── project/
    ├── STORYBOARD.md                   # Scene-by-scene script, beat markers & motion design
    ├── EDL_TIMELINE.json               # Edit Decision List with frame-accurate timing
    └── README.md                       # This file
```

---

## 🎬 How to Re-render the Reel

### 1. Regenerate Graphic Cards (if text/styling changes)
```bash
node render_scripts/generate_graphic_cards.js
```

### 2. Synthesize Cinematic Soundtrack
```bash
python3 render_scripts/generate_cinematic_soundtrack.py
```

### 3. Assemble and Render Master Videos
```bash
python3 render_scripts/assemble_reel.py
```

Outputs will be generated at:
- `output/Sutra_Launch_Reel_60s.mp4` (1080 × 1920 @ 30fps)
- `output/Sutra_Launch_Reel_Preview.mp4` (720 × 1280 @ 30fps)
