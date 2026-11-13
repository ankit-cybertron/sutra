const puppeteer = require('/opt/homebrew/lib/node_modules/puppeteer-core');
const fs = require('node:fs');
const path = require('node:path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = '/Users/cybertron/.gemini/antigravity/brain/a9e87169-898c-41ec-9c6e-0fa78dbffdcf';

const themes = [
  {
    id: 'brutal',
    name: '1. Brutal (Neo-Brutalist)',
    fontImport: 'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;600;700;900&family=JetBrains+Mono:wght@500&display=swap',
    css: `
      :root {
        --bg: #f8f8f6;
        --surface: #ffffff;
        --surface-2: #eeeeeb;
        --ink: #0d0d0d;
        --ink-2: #2a2a2a;
        --muted: #666666;
        --border: #0d0d0d;
        --border-w: 3px;
        --radius: 0px;
        --accent: #fff01f;
        --accent-ink: #0d0d0d;
        --font-head: 'Libre Franklin', sans-serif;
        --font-body: 'Libre Franklin', sans-serif;
        --font-mono: 'JetBrains Mono', monospace;
        --shadow: none;
      }
      .head-title { text-transform: uppercase; font-weight: 900; letter-spacing: -0.03em; }
      .pill-accent { background: var(--accent); color: var(--accent-ink); border: var(--border-w) solid var(--border); font-weight: 900; }
      .card-box { border: var(--border-w) solid var(--border); border-radius: var(--radius); background: var(--surface); }
      .btn-main { background: var(--ink); color: #fff; border: var(--border-w) solid var(--border); font-weight: 900; text-transform: uppercase; }
      .btn-main:hover { background: var(--accent); color: var(--ink); }
    `
  },
  {
    id: 'carnival',
    name: '2. Carnival (Neo-Print & Hard Shadows)',
    fontImport: 'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Golos+Text:wght@500;600;700&family=JetBrains+Mono:wght@500&display=swap',
    css: `
      :root {
        --bg: #f5edd8;
        --surface: #fdfaf2;
        --surface-2: #eae0c5;
        --ink: #1e1b18;
        --ink-2: #38332d;
        --muted: #6b6357;
        --border: #1e1b18;
        --border-w: 2.5px;
        --radius: 4px;
        --accent: #e59500;
        --accent-ink: #1e1b18;
        --font-head: 'Big Shoulders Display', sans-serif;
        --font-body: 'Golos Text', sans-serif;
        --font-mono: 'JetBrains Mono', monospace;
        --shadow: 4px 4px 0px #1e1b18;
      }
      .head-title { font-family: var(--font-head); font-size: 54px; text-transform: uppercase; letter-spacing: 0.02em; line-height: 0.95; }
      .pill-accent { background: var(--accent); color: var(--accent-ink); border: var(--border-w) solid var(--border); box-shadow: 2px 2px 0px var(--border); font-weight: 700; }
      .card-box { border: var(--border-w) solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }
      .btn-main { background: #962d2d; color: #fff; border: var(--border-w) solid var(--border); box-shadow: var(--shadow); font-weight: 700; }
      .btn-main:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px var(--border); }
    `
  },
  {
    id: 'sticker',
    name: '3. Sticker (Chunky Die-Cut & Rounded)',
    fontImport: 'https://fonts.googleapis.com/css2?family=Gabarito:wght@800;900&family=Sofia+Sans:wght@500;600;700&family=JetBrains+Mono:wght@500&display=swap',
    css: `
      :root {
        --bg: #f7f6f2;
        --surface: #ffffff;
        --surface-2: #f0ede4;
        --ink: #191816;
        --ink-2: #33312e;
        --muted: #757169;
        --border: #191816;
        --border-w: 2.5px;
        --radius: 18px;
        --accent: #ff4785;
        --accent-ink: #ffffff;
        --font-head: 'Gabarito', sans-serif;
        --font-body: 'Sofia Sans', sans-serif;
        --font-mono: 'JetBrains Mono', monospace;
        --shadow: 5px 5px 0px #191816;
      }
      .head-title { font-family: var(--font-head); font-weight: 900; letter-spacing: -0.02em; line-height: 1.05; }
      .pill-accent { background: #b8f542; color: var(--ink); border: var(--border-w) solid var(--border); border-radius: 999px; box-shadow: 3px 3px 0px var(--border); font-weight: 800; }
      .card-box { border: var(--border-w) solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }
      .btn-main { background: var(--accent); color: var(--accent-ink); border: var(--border-w) solid var(--border); border-radius: 999px; box-shadow: var(--shadow); font-weight: 800; }
      .btn-main:hover { transform: translateY(-2px); box-shadow: 5px 7px 0px var(--border); }
    `
  },
  {
    id: 'werkstatt',
    name: '4. Werkstatt (Bauhaus Architectural Grid)',
    fontImport: 'https://fonts.googleapis.com/css2?family=Jost:wght@700;800;900&family=Karla:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap',
    css: `
      :root {
        --bg: #e6e2d8;
        --surface: #f3efe6;
        --surface-2: #dad4c5;
        --ink: #1a1715;
        --ink-2: #2c2825;
        --muted: #5e5750;
        --border: #1a1715;
        --border-w: 2.5px;
        --radius: 0px;
        --accent: #0f4c81;
        --accent-ink: #ffffff;
        --accent-2: #d64024;
        --font-head: 'Jost', sans-serif;
        --font-body: 'Karla', sans-serif;
        --font-mono: 'JetBrains Mono', monospace;
        --shadow: none;
      }
      .head-title { font-family: var(--font-head); text-transform: uppercase; font-weight: 800; letter-spacing: -0.01em; line-height: 1.0; }
      .pill-accent { background: var(--accent-2); color: #fff; border: var(--border-w) solid var(--border); font-weight: 700; }
      .card-box { border: var(--border-w) solid var(--border); border-radius: var(--radius); background: var(--surface); }
      .btn-main { background: var(--accent); color: #fff; border: var(--border-w) solid var(--border); font-weight: 700; text-transform: uppercase; }
      .btn-main:hover { background: var(--ink); }
    `
  }
];

function generateHtml(theme) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sutra — ${theme.name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${theme.fontImport}" rel="stylesheet">
  <style>
    ${theme.css}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--ink);
      font-family: var(--font-body);
      padding: 0 0 60px 0;
      -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 32px; }
    
    /* NAV */
    .nav {
      background: var(--surface);
      border-bottom: var(--border-w) solid var(--border);
      padding: 16px 0;
      margin-bottom: 40px;
    }
    .nav-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo {
      font-family: var(--font-head);
      font-size: 28px;
      font-weight: 900;
      display: flex;
      align-items: center;
      gap: 10px;
      letter-spacing: -0.02em;
    }
    .logo-badge {
      font-size: 11px;
      padding: 3px 8px;
      border: var(--border-w) solid var(--border);
      background: var(--accent);
      color: var(--accent-ink);
      border-radius: var(--radius);
      font-weight: 700;
    }
    .nav-links {
      display: flex;
      gap: 24px;
      font-weight: 600;
      font-size: 14px;
    }
    .nav-cta {
      padding: 8px 18px;
      border: var(--border-w) solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      font-weight: 700;
      font-size: 13px;
      box-shadow: var(--shadow);
    }

    /* HERO */
    .hero {
      text-align: center;
      margin-bottom: 48px;
    }
    .tag-row {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 18px;
    }
    .pill {
      font-size: 12px;
      padding: 4px 12px;
      border-radius: var(--radius);
      font-weight: 700;
    }
    .h1-wrap {
      max-width: 900px;
      margin: 0 auto 20px auto;
    }
    .h1-text {
      font-size: 46px;
      color: var(--ink);
    }
    .hero-sub {
      font-size: 18px;
      color: var(--ink-2);
      max-width: 680px;
      margin: 0 auto 32px auto;
      line-height: 1.5;
    }

    /* WORKSPACE HERO CARDS */
    .hero-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 28px;
      align-items: start;
    }

    .idea-card {
      padding: 24px;
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1.5px solid var(--border);
    }
    .card-title {
      font-family: var(--font-head);
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .voice-orb {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border: var(--border-w) solid var(--border);
      border-radius: 999px;
      background: var(--surface-2);
      font-weight: 700;
      font-size: 12px;
      box-shadow: var(--shadow);
    }
    .bars {
      display: flex;
      align-items: center;
      gap: 3px;
      height: 14px;
    }
    .bars span {
      width: 3px;
      height: 12px;
      background: var(--ink);
      border-radius: 1px;
    }
    .bars span:nth-child(2) { height: 16px; }
    .bars span:nth-child(3) { height: 8px; }

    .textarea-mock {
      background: var(--surface-2);
      border: var(--border-w) solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      min-height: 120px;
      font-size: 16px;
      line-height: 1.6;
      color: var(--ink);
      margin-bottom: 18px;
    }
    .hindi-text {
      color: #962d2d;
      font-weight: 600;
    }
    
    .chips-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .chips-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 24px;
    }
    .chip {
      font-size: 12px;
      padding: 6px 12px;
      border: 1.5px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      font-weight: 600;
      box-shadow: var(--shadow);
    }
    .btn-main {
      width: 100%;
      padding: 16px 24px;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    /* RIGHT PLAN PREVIEW */
    .plan-card {
      padding: 24px;
    }
    .plan-badge {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 11px;
      padding: 3px 8px;
      background: var(--surface-2);
      border: 1.5px solid var(--border);
      font-weight: 700;
      margin-bottom: 12px;
      border-radius: var(--radius);
    }
    .plan-heading {
      font-family: var(--font-head);
      font-size: 22px;
      font-weight: 800;
      margin-bottom: 12px;
      line-height: 1.2;
    }
    .plan-slice {
      background: var(--surface-2);
      border: 1.5px solid var(--border);
      border-radius: var(--radius);
      padding: 14px;
      margin-bottom: 16px;
    }
    .slice-title {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .slice-desc {
      font-size: 13px;
      color: var(--ink-2);
      line-height: 1.4;
    }
    .agent-prompt-box {
      background: var(--ink);
      color: #fafafa;
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
      padding: 14px;
      border: var(--border-w) solid var(--border);
      border-radius: var(--radius);
    }
  </style>
</head>
<body>
  <nav class="nav">
    <div class="container nav-inner">
      <div class="logo">
        sutra
        <span class="logo-badge">सूत्र · Indic Voice Spec</span>
      </div>
      <div class="nav-links">
        <span>Hindi / Hinglish Engine</span>
        <span>Groq Compiler</span>
        <span>Architecture Generator</span>
      </div>
      <div class="nav-cta">
        New Project +
      </div>
    </div>
  </nav>

  <div class="container">
    <header class="hero">
      <div class="tag-row">
        <span class="pill pill-accent">INDIC VOICE-FIRST BLUEPRINT ENGINE</span>
        <span style="font-size:13px; font-weight:700; color:var(--muted);">Gnani.ai Prisma STT · Timbre TTS</span>
      </div>
      <div class="h1-wrap">
        <h1 class="head-title h1-text">Turn messy Hindi & Hinglish rambles into validated software blueprints.</h1>
      </div>
      <p class="hero-sub">Speak your raw thoughts naturally. Sutra transcribes code-mixed Indic audio, clarifies missing constraints, and outputs production specs with architecture diagrams.</p>
    </header>

    <div class="hero-grid">
      <!-- LEFT INPUT CARD -->
      <div class="card-box idea-card">
        <div class="card-top">
          <div class="card-title">1. Spoken Raw Idea</div>
          <div class="voice-orb">
            <div class="bars">
              <span></span><span></span><span></span>
            </div>
            Listening (Hindi / Hinglish)
          </div>
        </div>

        <div class="textarea-mock">
          "Ek aisa app chahiye jahan <span class="hindi-text">doctor clinic ke slots book ho sakein WhatsApp pe</span>, aur patient ko automated reminder jaye. Agar koi cancel kare toh waiting list wale ko turant notify ho."
        </div>

        <div class="chips-label">Try Spoken Indic Prompts</div>
        <div class="chips-list">
          <span class="chip">Doctor Clinic Slots (WhatsApp)</span>
          <span class="chip">Kirana Cash Ledger (Hinglish)</span>
          <span class="chip">College Fest QR Scanner</span>
        </div>

        <button class="btn-main">
          Compile Blueprint & Agents →
        </button>
      </div>

      <!-- RIGHT SPEC PREVIEW -->
      <div class="card-box plan-card">
        <div class="plan-badge">PLN-847291 · v1.0 Validated</div>
        <div class="plan-heading">WhatsApp Clinic Slot Engine</div>
        
        <div class="plan-slice">
          <div class="slice-title">Core Vertical Slice</div>
          <div class="slice-desc">Webhook receiving incoming WhatsApp messages, slot query matching, and automated FIFO waiting list re-allocation.</div>
        </div>

        <div class="chips-label">Target Coding Agent Prompt</div>
        <div class="agent-prompt-box">
          system: "Implement FastAPI webhook /whatsapp/events receiving twilio payload with HMAC SHA256 validation. Handle slot book and auto-cancellation logic with Redis atomic lock."
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function run() {
  console.log('Launching Chrome for theme renders...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  for (const theme of themes) {
    console.log('Rendering theme:', theme.name);
    const html = generateHtml(theme);
    const tmpHtml = path.join('/tmp', `sutra_${theme.id}.html`);
    fs.writeFileSync(tmpHtml, html, 'utf8');

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 920, deviceScaleFactor: 2 });
    await page.goto(`file://${tmpHtml}`, { waitUntil: 'load', timeout: 15000 });
    // Wait for fonts to settle
    await new Promise(r => setTimeout(r, 1000));

    const outPath = path.join(OUT_DIR, `sutra_theme_${theme.id}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log('Saved screenshot:', outPath);
    await page.close();
  }

  await browser.close();
  console.log('All 4 theme previews rendered successfully!');
}

run().catch(console.error);
