import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: "off",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      args: ["--headless=new", "--no-sandbox", "--disable-gpu"],
    },
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          args: ["--headless=new", "--no-sandbox", "--disable-gpu"],
        },
      },
    },
  ],
});
