import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { chromium } = require("../apps/web/node_modules/playwright");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.resolve(__dirname, "../assets");

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function renderHtmlToPng(htmlContent, outputPath, width = 1080, height = 1920, transparent = false) {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2, // 2x Retina quality
  });

  await page.setContent(htmlContent, { waitUntil: "networkidle" });
  await page.screenshot({
    path: outputPath,
    omitBackground: transparent,
  });
  await browser.close();
  console.log(`[GENERATED] ${outputPath}`);
}

async function main() {
  console.log("=== Generating Cinematic Graphics & Title Cards ===");

  // 1. CARD 1: 00-05s: "EVERY GREAT IDEA..."
  const card1Html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;600;900&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1080px;
        height: 1920px;
        background: #09090b;
        color: #ffffff;
        font-family: 'Geist', sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        position: relative;
        overflow: hidden;
      }
      .glow-spot {
        position: absolute;
        width: 800px;
        height: 800px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(235, 94, 40, 0.18) 0%, rgba(200, 30, 80, 0.08) 50%, transparent 70%);
        filter: blur(80px);
      }
      .badge {
        font-size: 20px;
        letter-spacing: 0.25em;
        text-transform: uppercase;
        color: #a1a1aa;
        margin-bottom: 30px;
        z-index: 10;
      }
      .headline {
        font-family: 'Instrument Serif', serif;
        font-size: 110px;
        line-height: 1.05;
        text-align: center;
        max-width: 900px;
        z-index: 10;
        letter-spacing: -0.02em;
      }
      .accent {
        font-style: italic;
        background: linear-gradient(135deg, #f97316 0%, #fb7185 50%, #818cf8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
    </style>
  </head>
  <body>
    <div class="glow-spot"></div>
    <div class="badge">A N E W  C H A P T E R</div>
    <div class="headline">EVERY GREAT<br><span class="accent">IDEA…</span></div>
  </body>
  </html>
  `;
  await renderHtmlToPng(card1Html, path.join(ASSETS_DIR, "title_01_idea.png"));

  // 2. CARD 2: 05-12s: "...DESERVES TO BECOME REALITY."
  const card2Html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;600;900&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1080px;
        height: 1920px;
        background: #09090b;
        color: #ffffff;
        font-family: 'Geist', sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        position: relative;
        overflow: hidden;
      }
      .glow-spot {
        position: absolute;
        width: 900px;
        height: 900px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(235, 94, 40, 0.12) 50%, transparent 70%);
        filter: blur(90px);
      }
      .badge {
        font-size: 20px;
        letter-spacing: 0.25em;
        text-transform: uppercase;
        color: #f43f5e;
        margin-bottom: 30px;
        z-index: 10;
        font-weight: 600;
      }
      .headline {
        font-family: 'Instrument Serif', serif;
        font-size: 105px;
        line-height: 1.08;
        text-align: center;
        max-width: 950px;
        z-index: 10;
        letter-spacing: -0.02em;
      }
      .accent {
        font-style: italic;
        background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
    </style>
  </head>
  <body>
    <div class="glow-spot"></div>
    <div class="badge">FROM SPOKEN WORDS</div>
    <div class="headline">…DESERVES TO<br>BECOME <span class="accent">REALITY.</span></div>
  </body>
  </html>
  `;
  await renderHtmlToPng(card2Html, path.join(ASSETS_DIR, "title_02_reality.png"));

  // 3. CARD 3: 12-20s: "INTRODUCING SUTRA" (Logo Reveal)
  const card3Html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;600;800;900&family=JetBrains+Mono:wght@500&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1080px;
        height: 1920px;
        background: #000000;
        color: #ffffff;
        font-family: 'Geist', sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        position: relative;
        overflow: hidden;
      }
      .glow-spot {
        position: absolute;
        width: 1100px;
        height: 1100px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(235, 94, 40, 0.3) 0%, rgba(244, 63, 94, 0.2) 40%, rgba(99, 102, 241, 0.1) 70%, transparent 85%);
        filter: blur(100px);
      }
      .eyebrow {
        font-family: 'JetBrains Mono', monospace;
        font-size: 24px;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        color: #f97316;
        margin-bottom: 24px;
        z-index: 10;
        font-weight: 600;
      }
      .brand-title {
        font-size: 160px;
        font-weight: 900;
        letter-spacing: -0.05em;
        line-height: 1;
        margin-bottom: 24px;
        z-index: 10;
        background: linear-gradient(180deg, #ffffff 30%, #a1a1aa 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .tagline {
        font-size: 32px;
        color: #d4d4d8;
        font-weight: 300;
        letter-spacing: 0.05em;
        text-align: center;
        max-width: 800px;
        line-height: 1.4;
        z-index: 10;
      }
      .pills {
        display: flex;
        gap: 16px;
        margin-top: 40px;
        z-index: 10;
      }
      .pill {
        padding: 10px 24px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 9999px;
        font-size: 18px;
        color: #e4e4e7;
        backdrop-filter: blur(10px);
      }
    </style>
  </head>
  <body>
    <div class="glow-spot"></div>
    <div class="eyebrow">INTRODUCING</div>
    <div class="brand-title">Sutra</div>
    <div class="tagline">Voice-First Specification & Architecture Engine</div>
    <div class="pills">
      <div class="pill">⚡ Sub-Second Voice STT</div>
      <div class="pill">🧠 Groq LPU Reasoning</div>
      <div class="pill">📐 React Flow Visuals</div>
    </div>
  </body>
  </html>
  `;
  await renderHtmlToPng(card3Html, path.join(ASSETS_DIR, "title_03_logo_reveal.png"));

  // 4. LOWER THIRDS & OVERLAYS (Transparent 1080x1920)
  // Overlay A: Step 1 Idea Submission
  const overlayIdeaHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Geist:wght@600;800&family=JetBrains+Mono:wght@500&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1080px;
        height: 1920px;
        background: transparent;
        font-family: 'Geist', sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 100px 60px;
      }
      .card {
        background: rgba(10, 10, 12, 0.88);
        backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 32px;
        padding: 36px 44px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7);
      }
      .step-num {
        font-family: 'JetBrains Mono', monospace;
        font-size: 20px;
        color: #f97316;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .title {
        font-size: 42px;
        color: #ffffff;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .desc {
        font-size: 24px;
        color: #a1a1aa;
        margin-top: 8px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="step-num">STAGE 01 · VOICE / TEXT INTAKE</div>
      <div class="title">Speak Your Concept Naturally</div>
      <div class="desc">English, Hindi or Hinglish. Zero prompt engineering required.</div>
    </div>
  </body>
  </html>
  `;
  await renderHtmlToPng(overlayIdeaHtml, path.join(ASSETS_DIR, "overlay_01_intake.png"), 1080, 1920, true);

  // Overlay B: Step 2 Clarification
  const overlayClarifyHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Geist:wght@600;800&family=JetBrains+Mono:wght@500&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1080px;
        height: 1920px;
        background: transparent;
        font-family: 'Geist', sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 100px 60px;
      }
      .card {
        background: rgba(10, 10, 12, 0.88);
        backdrop-filter: blur(24px);
        border: 1px solid rgba(244, 63, 94, 0.35);
        border-radius: 32px;
        padding: 36px 44px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7);
      }
      .step-num {
        font-family: 'JetBrains Mono', monospace;
        font-size: 20px;
        color: #fb7185;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .title {
        font-size: 42px;
        color: #ffffff;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .desc {
        font-size: 24px;
        color: #cbd5e1;
        margin-top: 8px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="step-num">STAGE 02 · AI CLARIFICATION</div>
      <div class="title">Intelligent Scope Discovery</div>
      <div class="desc">Two laser-targeted questions to eliminate ambiguity.</div>
    </div>
  </body>
  </html>
  `;
  await renderHtmlToPng(overlayClarifyHtml, path.join(ASSETS_DIR, "overlay_02_clarify.png"), 1080, 1920, true);

  // Overlay C: Step 3 Dynamic Readiness
  const overlayReadinessHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Geist:wght@600;800&family=JetBrains+Mono:wght@500&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1080px;
        height: 1920px;
        background: transparent;
        font-family: 'Geist', sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 100px 60px;
      }
      .card {
        background: rgba(10, 10, 12, 0.88);
        backdrop-filter: blur(24px);
        border: 1px solid rgba(56, 189, 248, 0.35);
        border-radius: 32px;
        padding: 36px 44px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7);
      }
      .step-num {
        font-family: 'JetBrains Mono', monospace;
        font-size: 20px;
        color: #38bdf8;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .title {
        font-size: 42px;
        color: #ffffff;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .desc {
        font-size: 24px;
        color: #cbd5e1;
        margin-top: 8px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="step-num">STAGE 03 · DYNAMIC AUDIT</div>
      <div class="title">10-Factor Readiness Score</div>
      <div class="desc">Rigorous weighted evaluation across architecture, security & APIs.</div>
    </div>
  </body>
  </html>
  `;
  await renderHtmlToPng(overlayReadinessHtml, path.join(ASSETS_DIR, "overlay_03_readiness.png"), 1080, 1920, true);

  // Overlay D: Step 4 React Flow Architecture
  const overlayArchHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Geist:wght@600;800&family=JetBrains+Mono:wght@500&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1080px;
        height: 1920px;
        background: transparent;
        font-family: 'Geist', sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 100px 60px;
      }
      .card {
        background: rgba(10, 10, 12, 0.88);
        backdrop-filter: blur(24px);
        border: 1px solid rgba(168, 85, 247, 0.35);
        border-radius: 32px;
        padding: 36px 44px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7);
      }
      .step-num {
        font-family: 'JetBrains Mono', monospace;
        font-size: 20px;
        color: #c084fc;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .title {
        font-size: 42px;
        color: #ffffff;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .desc {
        font-size: 24px;
        color: #cbd5e1;
        margin-top: 8px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="step-num">STAGE 04 · INTERACTIVE DIAGRAMS</div>
      <div class="title">React Flow + ELK.js Engine</div>
      <div class="desc">Interactive nodes, zoom & pan, multi-tier cloud topology.</div>
    </div>
  </body>
  </html>
  `;
  await renderHtmlToPng(overlayArchHtml, path.join(ASSETS_DIR, "overlay_04_arch.png"), 1080, 1920, true);

  // Overlay E: Step 5 Co-Pilot Refinement
  const overlayCopilotHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Geist:wght@600;800&family=JetBrains+Mono:wght@500&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1080px;
        height: 1920px;
        background: transparent;
        font-family: 'Geist', sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 100px 60px;
      }
      .card {
        background: rgba(10, 10, 12, 0.88);
        backdrop-filter: blur(24px);
        border: 1px solid rgba(34, 197, 94, 0.35);
        border-radius: 32px;
        padding: 36px 44px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7);
      }
      .step-num {
        font-family: 'JetBrains Mono', monospace;
        font-size: 20px;
        color: #4ade80;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .title {
        font-size: 42px;
        color: #ffffff;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .desc {
        font-size: 24px;
        color: #cbd5e1;
        margin-top: 8px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="step-num">STAGE 05 · PLAN CO-PILOT</div>
      <div class="title">Live Chat & Architecture Mutations</div>
      <div class="desc">Bumps versions live, updates stack and prompt-ready specs.</div>
    </div>
  </body>
  </html>
  `;
  await renderHtmlToPng(overlayCopilotHtml, path.join(ASSETS_DIR, "overlay_05_copilot.png"), 1080, 1920, true);

  // 5. CLIMAX & FINAL BRAND REVEAL (52 - 60s)
  const cardFinalHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;600;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1080px;
        height: 1920px;
        background: #000000;
        color: #ffffff;
        font-family: 'Geist', sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        position: relative;
        overflow: hidden;
      }
      .glow-spot {
        position: absolute;
        width: 1100px;
        height: 1100px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(235, 94, 40, 0.35) 0%, rgba(244, 63, 94, 0.25) 35%, rgba(99, 102, 241, 0.15) 65%, transparent 85%);
        filter: blur(100px);
      }
      .kicker {
        font-family: 'Instrument Serif', serif;
        font-size: 80px;
        line-height: 1.1;
        text-align: center;
        margin-bottom: 20px;
        z-index: 10;
        color: #e4e4e7;
      }
      .kicker span {
        font-style: italic;
        background: linear-gradient(135deg, #f97316 0%, #fb7185 50%, #818cf8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .brand-title {
        font-size: 190px;
        font-weight: 900;
        letter-spacing: -0.06em;
        line-height: 0.95;
        margin-bottom: 30px;
        z-index: 10;
        background: linear-gradient(180deg, #ffffff 40%, #71717a 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .url-box {
        margin-top: 40px;
        padding: 16px 40px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 9999px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 26px;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: #38bdf8;
        backdrop-filter: blur(12px);
        z-index: 10;
      }
      .subtext {
        margin-top: 24px;
        font-size: 20px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: #71717a;
        z-index: 10;
      }
    </style>
  </head>
  <body>
    <div class="glow-spot"></div>
    <div class="kicker">YOUR IDEA.<br>YOUR VISION.<br><span>YOUR SUTRA.</span></div>
    <div class="brand-title">Sutra</div>
    <div class="url-box">d3dv21umcveu3t.cloudfront.net</div>
    <div class="subtext">LIVE ON AWS & MULTI-CLOUD</div>
  </body>
  </html>
  `;
  await renderHtmlToPng(cardFinalHtml, path.join(ASSETS_DIR, "title_06_final_brand.png"));

  console.log("=== All Cinematic Graphics & Title Cards Generated Successfully! ===");
}

main().catch(console.error);
