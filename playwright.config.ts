import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for end-to-end browser tests.
 *
 * Vitest covers the bulk of our suite (jsdom). Playwright is reserved for
 * scenarios that genuinely need a real browser — e.g. mid-survey language
 * toggling where we want to assert the rendered DOM after Framer Motion's
 * `layoutId` animation, real focus, and real session storage all behave.
 *
 * Run locally:
 *   bunx playwright install chromium    # one-time
 *   bun run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
