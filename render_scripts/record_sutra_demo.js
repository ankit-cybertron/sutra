import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { chromium } = require("../apps/web/node_modules/playwright");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RECORDINGS_DIR = path.resolve(__dirname, "../recordings");

if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const APP_URL = "http://localhost:3000";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recordScene(sceneName, actionsFn, options = {}) {
  const sceneDir = path.join(RECORDINGS_DIR, sceneName);
  if (fs.existsSync(sceneDir)) {
    fs.rmSync(sceneDir, { recursive: true, force: true });
  }
  fs.mkdirSync(sceneDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const width = options.width || 1080;
  const height = options.height || 1920;

  const context = await browser.newContext({
    recordVideo: {
      dir: sceneDir,
      size: { width, height },
    },
    viewport: { width, height },
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  const page = await context.newPage();

  console.log(`[REC] Starting scene: ${sceneName}...`);
  try {
    await actionsFn(page);
  } catch (err) {
    console.error(`[REC ERROR] in ${sceneName}:`, err);
  }

  await sleep(1000);
  await context.close();
  await browser.close();

  // Find the recorded webm file in sceneDir and rename to sceneName.webm
  const files = fs.readdirSync(sceneDir);
  const videoFile = files.find((f) => f.endsWith(".webm"));
  if (videoFile) {
    const srcPath = path.join(sceneDir, videoFile);
    const destPath = path.join(RECORDINGS_DIR, `${sceneName}.webm`);
    fs.copyFileSync(srcPath, destPath);
    console.log(`[REC SAVED] ${destPath}`);
  }
}

async function main() {
  console.log("=== Starting Sutra Reel Automated Video Captures ===");

  // SCENE 1: Hero & Intro (Vertical 1080x1920)
  await recordScene("scene1_hero", async (page) => {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await sleep(2500); // intro animation 0% -> 100%
    await sleep(2000); // hero reveal
    // Smooth scroll down slightly to show tags and features
    await page.mouse.move(540, 800, { steps: 20 });
    await sleep(1000);
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: "smooth" }));
    await sleep(1500);
    await page.evaluate(() => window.scrollBy({ top: -300, behavior: "smooth" }));
    await sleep(1500);
  });

  // SCENE 2: Idea Typing & Submission
  await recordScene("scene2_idea_input", async (page) => {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await sleep(2000);
    const textarea = page.locator('textarea[aria-label="Your idea"], textarea').first();
    await textarea.click();
    await sleep(500);
    const ideaText =
      "BusTrack — Real-time school bus fleet tracker with WhatsApp parent notifications and driver attendance";
    for (const char of ideaText) {
      await page.keyboard.type(char, { delay: 25 });
    }
    await sleep(1000);
    // Find and hover the refine button
    const refineBtn = page.getByRole("button", { name: /Recommended|Refine/i }).first();
    if (await refineBtn.isVisible()) {
      await refineBtn.hover();
      await sleep(800);
      await refineBtn.click();
    } else {
      await page.keyboard.press("Meta+Enter");
    }
    await sleep(3000);
  });

  // SCENE 3: AI Clarification & Answering
  await recordScene("scene3_clarification", async (page) => {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await sleep(1500);
    const textarea = page.locator('textarea[aria-label="Your idea"], textarea').first();
    await textarea.fill("BusTrack — Real-time school bus fleet tracker with WhatsApp parent notifications");
    const refineBtn = page.getByRole("button", { name: /Recommended|Refine/i }).first();
    if (await refineBtn.isVisible()) {
      await refineBtn.click();
    } else {
      await page.keyboard.press("Meta+Enter");
    }

    // Wait for clarifying panel
    await page.waitForSelector('input[placeholder*="Speak or type"], textarea', { timeout: 15000 });
    await sleep(2000); // listen to question

    const answerInput = page.locator('input[placeholder*="Speak or type"]').first();
    if (await answerInput.isVisible()) {
      await answerInput.click();
      await sleep(500);
      const ans1 = "WhatsApp Cloud API notifications with verified student IDs and live Google Maps links";
      for (const char of ans1) {
        await page.keyboard.type(char, { delay: 20 });
      }
      await sleep(800);
      await page.keyboard.press("Enter");
      await sleep(2500);

      // Check if second question appeared
      if (await answerInput.isVisible()) {
        const ans2 = "Local SQLite buffer on driver mobile app with automatic queue sync on reconnect";
        for (const char of ans2) {
          await page.keyboard.type(char, { delay: 20 });
        }
        await sleep(800);
        await page.keyboard.press("Enter");
        await sleep(3000);
      }
    }
  });

  // SCENE 4: Plan Workspace & Readiness Score (Desktop/Portrait reframed)
  await recordScene("scene4_readiness_score", async (page) => {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await sleep(1500);
    const textarea = page.locator('textarea[aria-label="Your idea"], textarea').first();
    await textarea.fill("BusTrack — Real-time school bus fleet tracker");
    // Click Compile directly to quickly get to the plan workspace
    const compileBtn = page.getByRole("button", { name: /Compile/i }).first();
    if (await compileBtn.isVisible()) {
      await compileBtn.click();
    } else {
      const refineBtn = page.getByRole("button", { name: /Recommended|Refine/i }).first();
      await refineBtn.click();
      await sleep(2000);
      const skipAllBtn = page.getByRole("button", { name: /Skip all/i }).first();
      if (await skipAllBtn.isVisible()) await skipAllBtn.click();
    }

    // Wait for plan workspace
    await page.waitForSelector('text="Readiness"', { timeout: 30000 });
    await sleep(2000);

    // Click Readiness score badge to open the 10-Factor Assessment
    const readinessBtn = page.locator('button:has-text("Readiness")').first();
    if (await readinessBtn.isVisible()) {
      await readinessBtn.hover();
      await sleep(800);
      await readinessBtn.click();
      await sleep(3500); // Show full 10-factor score breakdown
    }
  });

  // SCENE 5: Interactive Architecture Diagram (Desktop 1920x1080 captured high-res)
  await recordScene(
    "scene5_architecture",
    async (page) => {
      await page.goto(APP_URL, { waitUntil: "networkidle" });
      await sleep(1500);
      const textarea = page.locator('textarea[aria-label="Your idea"], textarea').first();
      await textarea.fill("BusTrack — Real-time school bus fleet tracker with WhatsApp alerts");
      const compileBtn = page.getByRole("button", { name: /Compile/i }).first();
      if (await compileBtn.isVisible()) {
        await compileBtn.click();
      } else {
        const refineBtn = page.getByRole("button", { name: /Recommended|Refine/i }).first();
        await refineBtn.click();
        await sleep(2000);
        const skipAllBtn = page.getByRole("button", { name: /Skip all/i }).first();
        if (await skipAllBtn.isVisible()) await skipAllBtn.click();
      }

      await page.waitForSelector('text="Architecture"', { timeout: 30000 });
      await sleep(2000);

      // Click Architecture tab
      const archTab = page.locator('button:has-text("Architecture")').first();
      if (await archTab.isVisible()) {
        await archTab.click();
        await sleep(2500);
      }

      // Smooth pan across React Flow nodes
      const rf = page.locator(".react-flow").first();
      if (await rf.isVisible()) {
        const box = await rf.boundingBox();
        if (box) {
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          await page.mouse.move(cx, cy);
          await page.mouse.down();
          await page.mouse.move(cx - 150, cy - 80, { steps: 25 });
          await page.mouse.up();
          await sleep(1500);
        }
      }

      // Click a node to inspect details
      const node = page.locator(".react-flow__node").first();
      if (await node.isVisible()) {
        await node.hover();
        await sleep(800);
        await node.click();
        await sleep(2500);
      }
    },
    { width: 1440, height: 1800 }
  );

  // SCENE 6: Plan Co-Pilot Interaction
  await recordScene(
    "scene6_copilot",
    async (page) => {
      await page.goto(APP_URL, { waitUntil: "networkidle" });
      await sleep(1500);
      const textarea = page.locator('textarea[aria-label="Your idea"], textarea').first();
      await textarea.fill("BusTrack — Real-time school bus fleet tracker");
      const compileBtn = page.getByRole("button", { name: /Compile/i }).first();
      if (await compileBtn.isVisible()) {
        await compileBtn.click();
      }

      await page.waitForSelector('textarea[placeholder*="Ask to change"]', { timeout: 30000 });
      await sleep(2000);

      const chatInput = page.locator('textarea[placeholder*="Ask to change"]').first();
      if (await chatInput.isVisible()) {
        await chatInput.click();
        await sleep(500);
        const msg = "Add automated geofencing alerts when bus enters the school perimeter";
        for (const char of msg) {
          await page.keyboard.type(char, { delay: 20 });
        }
        await sleep(800);
        await page.keyboard.press("Enter");
        await sleep(4000); // Show co-pilot thinking and responding
      }
    },
    { width: 1080, height: 1920 }
  );

  console.log("=== All Sutra Demo Scenes Successfully Recorded! ===");
}

main().catch(console.error);
