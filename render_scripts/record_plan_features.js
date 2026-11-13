import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { chromium } = require("../apps/web/node_modules/playwright");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RECORDINGS_DIR = path.resolve(__dirname, "../recordings");

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PLAN_URL = "http://localhost:3000/#p=pln_2320ef1bde";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recordClip(name, width, height, actionsFn) {
  const clipDir = path.join(RECORDINGS_DIR, name);
  if (fs.existsSync(clipDir)) fs.rmSync(clipDir, { recursive: true, force: true });
  fs.mkdirSync(clipDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const context = await browser.newContext({
    recordVideo: { dir: clipDir, size: { width, height } },
    viewport: { width, height },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();
  console.log(`[REC] Recording ${name} (${width}x${height})...`);
  try {
    await actionsFn(page);
  } catch (err) {
    console.error(`[ERR] in ${name}:`, err);
  }
  await sleep(1000);
  await context.close();
  await browser.close();

  const files = fs.readdirSync(clipDir);
  const v = files.find((f) => f.endsWith(".webm"));
  if (v) {
    fs.copyFileSync(path.join(clipDir, v), path.join(RECORDINGS_DIR, `${name}.webm`));
    console.log(`[SAVED] ${name}.webm`);
  }
}

async function main() {
  // 1. Architecture Diagram Clip (High-res 1080x1920 portrait focus on React Flow)
  await recordClip("scene5_reactflow_arch", 1080, 1920, async (page) => {
    await page.goto(PLAN_URL, { waitUntil: "networkidle" });
    await sleep(2500);

    // Scroll down to the architecture diagram
    const archBtn = page.locator('button:has-text("Architecture")').first();
    if (await archBtn.isVisible()) {
      await archBtn.click();
      await sleep(1500);
    }

    // Hover and drag canvas
    const rf = page.locator(".react-flow").first();
    if (await rf.isVisible()) {
      const box = await rf.boundingBox();
      if (box) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy);
        await sleep(500);
        // Drag canvas
        await page.mouse.down();
        await page.mouse.move(cx - 100, cy - 60, { steps: 20 });
        await page.mouse.up();
        await sleep(1000);
      }
    }

    // Click on a node
    const node = page.locator(".react-flow__node").first();
    if (await node.isVisible()) {
      await node.hover();
      await sleep(800);
      await node.click();
      await sleep(3000);
    }
  });

  // 2. Co-Pilot Live Chat Clip (1080x1920 portrait)
  await recordClip("scene6_copilot_chat", 1080, 1920, async (page) => {
    await page.goto(PLAN_URL, { waitUntil: "networkidle" });
    await sleep(2500);

    // Scroll to right side or co-pilot chat
    const chatInput = page.locator('textarea[placeholder*="Ask to change"]').first();
    if (await chatInput.isVisible()) {
      await chatInput.click();
      await sleep(600);
      const text = "Add automated geofencing alerts when bus enters the school perimeter";
      for (const c of text) {
        await page.keyboard.type(c, { delay: 25 });
      }
      await sleep(1000);
      await page.keyboard.press("Enter");
      await sleep(4000); // Response appears
    }
  });

  // 3. Readiness Score Assessment Breakdown Clip (1080x1920 portrait)
  await recordClip("scene4_readiness_modal", 1080, 1920, async (page) => {
    await page.goto(PLAN_URL, { waitUntil: "networkidle" });
    await sleep(2500);

    const readinessBtn = page.locator('button:has-text("Readiness")').first();
    if (await readinessBtn.isVisible()) {
      await readinessBtn.hover();
      await sleep(800);
      await readinessBtn.click();
      await sleep(4000); // Inspect 10 factors
    }
  });

  console.log("=== High-Precision Plan Feature Clips Recorded! ===");
}

main().catch(console.error);
