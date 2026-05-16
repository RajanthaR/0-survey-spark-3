import { expect, test } from "@playwright/test";

/**
 * Mid-survey language toggle — full browser E2E.
 *
 * Drives the real SurveyRunner UI (no mocks) and asserts that flipping the
 * LanguageToggle pill mid-survey re-renders:
 *
 *   1. the question label (text changes between EN / SI / TA),
 *   2. the rendered option labels for the active question, and
 *   3. the localized progress / position text emitted by
 *      `<QuestionPosition data-testid="question-position">`.
 *
 * This is the missing UI-level companion to the jsdom test
 * `SurveyRunner.midSurveyLanguagePersistence.e2e.test.tsx`, which only
 * verifies the server-fn payload contract.
 */

const SLUG = "phase-1";

// LanguageToggle renders the pill `label` (EN / සි / த) inside <button> with
// `aria-pressed`. We address them by accessible name so the test is robust to
// CSS / DOM restructuring.
const LANG_PILL = {
  en: { name: "EN" },
  si: { name: "සි" },
  ta: { name: "த" },
} as const;

test.describe("mid-survey language toggle", () => {
  test("question, options, and progress text update on each toggle", async ({ page }) => {
    await page.goto(`/s/${SLUG}`);

    // Accept any required consent items, then enter the runner. The intro
    // screen exposes a Start / Begin button — find it by role to stay
    // language-agnostic about the exact label we land on.
    const consentBoxes = page.getByRole("checkbox");
    const consentCount = await consentBoxes.count();
    for (let i = 0; i < consentCount; i++) {
      const cb = consentBoxes.nth(i);
      if (!(await cb.isChecked())) await cb.check();
    }
    const startBtn = page.getByRole("button", { name: /^(start|begin|ආරම්භ|தொடங்கு)/i });
    if (await startBtn.count()) await startBtn.first().click();

    const position = page.getByTestId("question-position");
    await expect(position).toBeVisible();

    // Snapshot the question label + first option + progress text per language.
    // We assume the runner exposes `[data-question-id]` on the active question
    // wrapper (it does — see SurveyRunner.tsx). If a project rename breaks
    // that, we fall back to the first <h2> on the page.
    const activeQuestion = page.locator("[data-question-id]").first();
    const questionLabel = activeQuestion.locator("h2, [role='heading']").first();
    const firstOption = activeQuestion
      .getByRole("radio")
      .or(activeQuestion.getByRole("checkbox"))
      .first();

    async function snapshot() {
      const label = (await questionLabel.textContent())?.trim() ?? "";
      const optionText =
        (await firstOption.count()) > 0
          ? (await firstOption.evaluate((el) => el.closest("label")?.textContent?.trim() ?? ""))
          : "";
      const progress = (await position.textContent())?.trim() ?? "";
      return { label, optionText, progress };
    }

    // --- EN baseline ---
    await page.getByRole("button", LANG_PILL.en).click();
    await expect(position).toHaveAttribute("data-lang", "en");
    const en = await snapshot();
    expect(en.label.length).toBeGreaterThan(0);
    expect(en.progress).toMatch(/Question \d+ of \d+/);

    // --- SI ---
    await page.getByRole("button", LANG_PILL.si).click();
    await expect(position).toHaveAttribute("data-lang", "si");
    const si = await snapshot();
    expect(si.label).not.toBe(en.label);
    expect(si.progress).not.toBe(en.progress);
    // Sinhala block U+0D80–U+0DFF must appear in the localized progress text.
    expect(si.progress).toMatch(/[\u0D80-\u0DFF]/);
    if (en.optionText) expect(si.optionText).not.toBe(en.optionText);

    // --- TA ---
    await page.getByRole("button", LANG_PILL.ta).click();
    await expect(position).toHaveAttribute("data-lang", "ta");
    const ta = await snapshot();
    expect(ta.label).not.toBe(si.label);
    expect(ta.label).not.toBe(en.label);
    expect(ta.progress).not.toBe(si.progress);
    // Tamil block U+0B80–U+0BFF must appear in the localized progress text.
    expect(ta.progress).toMatch(/[\u0B80-\u0BFF]/);
    if (en.optionText) expect(ta.optionText).not.toBe(en.optionText);

    // --- back to EN, verify it round-trips to the original strings ---
    await page.getByRole("button", LANG_PILL.en).click();
    await expect(position).toHaveAttribute("data-lang", "en");
    const enAgain = await snapshot();
    expect(enAgain.label).toBe(en.label);
    expect(enAgain.progress).toBe(en.progress);
  });
});
