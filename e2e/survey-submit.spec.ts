import { expect, test, type Locator, type Page } from "@playwright/test";

const SLUG = "phase-1";
const RESUME_KEY = `eip.resume.${SLUG}`;
const LEGACY_RESUME_KEY = `eip.token.${SLUG}`;

const REQUIRED_SUPABASE_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

const missingSupabaseEnv = REQUIRED_SUPABASE_ENV.filter((key) => !process.env[key]);
const turnstileWidgetBlocksHeadless =
  !!process.env.VITE_TURNSTILE_SITE_KEY &&
  process.env.VITE_TURNSTILE_DISABLED !== "true" &&
  process.env.TURNSTILE_DISABLED !== "true";
const turnstileServerBlocksHeadless =
  !!process.env.TURNSTILE_SECRET &&
  process.env.TURNSTILE_DISABLED !== "true" &&
  process.env.ALLOW_TURNSTILE_BYPASS !== "true";

const skipReason =
  missingSupabaseEnv.length > 0
    ? `live Supabase env missing: ${missingSupabaseEnv.join(", ")}`
    : turnstileWidgetBlocksHeadless
      ? "Turnstile widget is enabled; set VITE_TURNSTILE_DISABLED=true for headless e2e"
      : turnstileServerBlocksHeadless
        ? "Turnstile secret is enabled without TURNSTILE_DISABLED or ALLOW_TURNSTILE_BYPASS"
        : undefined;

async function isVisible(locator: Locator): Promise<boolean> {
  return locator.isVisible().catch(() => false);
}

async function fillFirstTextInput(field: Locator) {
  const input = field.locator("input:not([type='hidden']), textarea").first();
  if ((await input.count()) === 0) return false;

  const tagName = await input.evaluate((el) => el.tagName.toLowerCase());
  const type = (await input.getAttribute("type")) ?? "text";
  const value =
    type === "email"
      ? "e2e-submission@example.test"
      : type === "tel"
        ? "+94112345678"
        : type === "number"
          ? "42"
          : tagName === "textarea"
            ? "Playwright submission smoke answer"
            : "Playwright submission";
  await input.fill(value);
  return true;
}

async function answerCurrentQuestion(page: Page) {
  const field = page.getByTestId("question-field");
  await expect(field).toBeVisible({ timeout: 15_000 });

  const radio = field.getByRole("radio").first();
  if ((await radio.count()) > 0) {
    await radio.press("Space");
    return;
  }

  const pressedButton = field.locator("button[aria-pressed]").first();
  if ((await pressedButton.count()) > 0) {
    await pressedButton.click();
    return;
  }

  if (await fillFirstTextInput(field)) return;
}

async function continueFromOptionalConsent(page: Page) {
  await expect(page.getByRole("heading", { name: /Optional permissions/i })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: /^Continue$/i }).click();

  if (
    process.env.TURNSTILE_SECRET &&
    process.env.ALLOW_TURNSTILE_BYPASS === "true" &&
    process.env.TURNSTILE_DISABLED !== "true"
  ) {
    await expect(page.getByTestId("consent-verify-error")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("consent-verify-bypass").click();
  }
}

async function answerUntilReview(page: Page) {
  for (let step = 0; step < 80; step++) {
    const nextButton = page.getByTestId("next-button").first();
    if ((await nextButton.count()) === 0 || !(await isVisible(nextButton))) break;

    await answerCurrentQuestion(page);
    await nextButton.click();

    const errorSummary = page.getByTestId("error-summary");
    if (await errorSummary.isVisible({ timeout: 750 }).catch(() => false)) {
      throw new Error(`Survey validation blocked progress: ${await errorSummary.textContent()}`);
    }
    await page.waitForTimeout(100);
  }

  await expect(page.getByRole("heading", { name: /Review/i })).toBeVisible({ timeout: 15_000 });
}

test.describe("survey submission flow", () => {
  test.skip(Boolean(skipReason), skipReason ?? "live survey submission prerequisites unavailable");

  test("submits phase-1 and clears the resume token", async ({ page }) => {
    await page.addInitScript(
      ({ resumeKey, legacyResumeKey }) => {
        window.localStorage.removeItem(resumeKey);
        window.localStorage.removeItem(legacyResumeKey);
      },
      { resumeKey: RESUME_KEY, legacyResumeKey: LEGACY_RESUME_KEY },
    );

    await page.goto(`/s/${SLUG}`);

    await page.getByRole("button", { name: /^Start$/i }).click();
    await page.getByRole("button", { name: /I agree and want to continue/i }).click();
    await continueFromOptionalConsent(page);

    await expect(page.getByTestId("question-position")).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), RESUME_KEY), {
        timeout: 15_000,
      })
      .not.toBeNull();

    await answerUntilReview(page);

    await page.getByRole("button", { name: /^Next$/i }).click();
    await expect(page.getByLabel(/Email \(optional\)/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /^Submit$/i }).click();
    await expect(page.getByRole("heading", { name: /Thank you/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), RESUME_KEY), {
        timeout: 15_000,
      })
      .toBeNull();
  });
});
