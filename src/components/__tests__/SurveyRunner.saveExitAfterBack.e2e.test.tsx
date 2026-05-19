/**
 * E2E: Save & Exit mid-survey AFTER pressing Back must persist
 *
 *   • every answer the user has typed so far (Q1, Q2, Q3) — Back must
 *     NOT discard the in-flight Q3 answer just because the pointer
 *     stepped backward to Q2
 *   • the language that is active at the moment of Save & Exit
 *
 * and on resume (re-mounting `<SurveyRunner>` with the persisted
 * `initialAnswers` + `initialLanguage`) the runner must:
 *
 *   • land on the questions stage (not intro / consent)
 *   • render the progress header in the persisted language (SI)
 *   • surface the previously-typed answers when the user steps through
 *     Q1 → Q2 → Q3 — proving no answer was dropped during the
 *     Back-then-Save-&-Exit-then-resume round trip
 *   • keep the LanguageToggle aria-pressed state on the persisted lang
 *   • keep the header progress chip / aria-valuenow aligned with the
 *     persisted progressPct (no regression to 0%)
 */
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";
import { I18nProvider, UI, pickText, type Lang } from "@/lib/i18n";
import { formatQuestionPosition } from "@/lib/format";
import type { Survey } from "@/surveys/types";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => {} }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));

const saveAnswers = vi.fn().mockResolvedValue({});
const startResponse = vi.fn().mockResolvedValue({ resumeToken: "tok" });
const completeResponse = vi.fn().mockResolvedValue({});
vi.mock("@/lib/responses.functions", () => ({
  startResponse: (...args: unknown[]) => startResponse(...args),
  saveAnswers: (...args: unknown[]) => saveAnswers(...args),
  completeResponse: (...args: unknown[]) => completeResponse(...args),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(() => {}, { success: () => {}, error: () => {} }),
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const passthrough = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) =>
      React.createElement(tag, { ...props, ref }),
    );
  return {
    motion: new Proxy({}, { get: (_t, key: string) => passthrough(key) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => false,
  };
});

import { SurveyRunner } from "@/components/SurveyRunner";

const TOTAL = 3;
const SURVEY: Survey = {
  slug: "save-exit-after-back",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: Array.from({ length: TOTAL }, (_, i) => ({
    id: `q${i + 1}`,
    type: "text" as const,
    section: { en: "S", si: "කොටස", ta: "பகுதி" },
    label: { en: `Q${i + 1}`, si: `Q${i + 1}`, ta: `Q${i + 1}` },
    required: true,
  })),
};

const ANS = ["alpha", "beta", "gamma"] as const;

function input(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector("input[type=text]") as HTMLInputElement | null;
  if (!el) throw new Error("question input not found");
  return el;
}
function nextBtn(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector("nav button.flex-1") as HTMLButtonElement | null;
  if (!btn) throw new Error("Next button not found");
  return btn;
}
function backBtn(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector("nav button") as HTMLButtonElement | null;
  if (!btn) throw new Error("Back button not found");
  return btn;
}
function saveExitBtn(container: HTMLElement, lang: Lang): HTMLButtonElement {
  // Bottom nav: [Back, Save & Exit, Next]. Match by localized aria-label
  // (filter in JS rather than CSS — the SI/TA labels contain "&" which is
  // awkward in CSS attribute selectors).
  const expected = pickText(UI.saveExit, lang);
  const btn = Array.from(container.querySelectorAll<HTMLButtonElement>("nav button")).find(
    (b) => b.getAttribute("aria-label") === expected,
  );
  if (!btn) throw new Error(`Save & exit button not found for lang=${lang}`);
  return btn;
}
function langButton(container: HTMLElement, code: Lang): HTMLButtonElement {
  const labels: Record<Lang, string> = { en: "EN", si: "සි", ta: "த" };
  const btns = Array.from(
    container.querySelectorAll<HTMLButtonElement>("header button[aria-pressed]"),
  );
  const found = btns.find((b) => b.textContent?.trim() === labels[code]);
  if (!found) throw new Error(`lang button ${code} not found`);
  return found;
}
function position(container: HTMLElement): HTMLElement {
  return container.querySelector("[data-testid=question-position]") as HTMLElement;
}
function progressBar(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[role="progressbar"]') as HTMLElement | null;
  if (!el) throw new Error("progressbar not found");
  return el;
}
function pctChipText(container: HTMLElement): string {
  const sib = container.querySelector('[data-testid="progress-percent-chip"]');
  return sib?.textContent?.trim() ?? "";
}

async function expectPosition(container: HTMLElement, lang: Lang, current: number) {
  await waitFor(() =>
    expect(position(container).textContent?.trim()).toBe(
      formatQuestionPosition(current, TOTAL, lang),
    ),
  );
}

async function fillAndNext(container: HTMLElement, value: string) {
  fireEvent.change(input(container), { target: { value } });
  act(() => nextBtn(container).click());
}

describe("SurveyRunner — Save & Exit after Back preserves answers + language on resume", () => {
  it("captures every answer and the active language at the moment of Save & Exit, then restores them on resume", async () => {
    saveAnswers.mockClear();

    // ── 1. Initial session in EN, then user switches to SI mid-flow ──
    const { container, unmount } = render(
      <I18nProvider>
        <SurveyRunner survey={SURVEY} initialToken="tok" initialLanguage="en" />
      </I18nProvider>,
    );
    await expectPosition(container, "en", 1);

    // Switch to SI before answering — exercises the toggle path.
    act(() => langButton(container, "si").click());
    await expectPosition(container, "si", 1);
    expect(langButton(container, "si").getAttribute("aria-pressed")).toBe("true");

    // Answer Q1 → Q2 → Q3, then Back to Q2.
    await fillAndNext(container, ANS[0]);
    await expectPosition(container, "si", 2);
    await fillAndNext(container, ANS[1]);
    await expectPosition(container, "si", 3);
    // Type Q3's answer too — Back must not drop it.
    fireEvent.change(input(container), { target: { value: ANS[2] } });
    act(() => backBtn(container).click());
    await expectPosition(container, "si", 2);

    // Snapshot the percent chip / aria-valuenow that the user can see at
    // the moment they hit Save & Exit. Resume must not regress below this.
    const persistedPctText = pctChipText(container);
    const persistedValueNow = progressBar(container).getAttribute("aria-valuenow");
    expect(persistedPctText).toMatch(/^\d+%$/);

    // ── 2. Click Save & Exit ──
    await act(async () => {
      saveExitBtn(container, "si").click();
    });

    // Inspect the LAST saveAnswers call (manualSave is the click target —
    // the debounced background save may also fire, so we look at the most
    // recent invocation, which is the one Save & Exit triggered).
    await waitFor(() => expect(saveAnswers).toHaveBeenCalled());
    const lastCall = saveAnswers.mock.calls[saveAnswers.mock.calls.length - 1];
    const payload = lastCall[0]?.data as {
      resumeToken: string;
      answers: Record<string, unknown>;
      progressPct: number;
      language: Lang;
    };
    expect(payload.resumeToken).toBe("tok");
    expect(payload.language).toBe("si");
    // All three typed answers must be in the payload — Back did not drop Q3.
    expect(payload.answers).toMatchObject({
      q1: ANS[0],
      q2: ANS[1],
      q3: ANS[2],
    });
    // The persisted progress matches what the user saw.
    expect(`${payload.progressPct}%`).toBe(persistedPctText);

    unmount();

    // ── 3. Re-mount the runner with the persisted state (resume) ──
    const { container: c2 } = render(
      <I18nProvider>
        <SurveyRunner
          survey={SURVEY}
          initialToken="tok"
          initialAnswers={payload.answers}
          initialLanguage={payload.language}
        />
      </I18nProvider>,
    );

    // Header re-renders in SI, not EN — language preserved.
    await expectPosition(c2, "si", 1);
    expect(langButton(c2, "si").getAttribute("aria-pressed")).toBe("true");
    expect(langButton(c2, "en").getAttribute("aria-pressed")).toBe("false");
    expect(progressBar(c2).getAttribute("aria-label")).toBe(pickText(UI.progress, "si"));

    // Progress chip restored — never regresses below the persisted value.
    expect(pctChipText(c2)).toBe(persistedPctText);
    expect(progressBar(c2).getAttribute("aria-valuenow")).toBe(persistedValueNow);

    // Q1's input shows the previously-typed answer (no data loss).
    expect(input(c2).value).toBe(ANS[0]);
    // Step forward — Q2 and Q3 also show their persisted answers.
    act(() => nextBtn(c2).click());
    await expectPosition(c2, "si", 2);
    expect(input(c2).value).toBe(ANS[1]);
    act(() => nextBtn(c2).click());
    await expectPosition(c2, "si", 3);
    expect(input(c2).value).toBe(ANS[2]);
  });

  it("when the user toggles language AFTER Back but BEFORE Save & Exit, the persisted payload uses the LATER language", async () => {
    saveAnswers.mockClear();

    const { container } = render(
      <I18nProvider>
        <SurveyRunner survey={SURVEY} initialToken="tok" initialLanguage="en" />
      </I18nProvider>,
    );
    await expectPosition(container, "en", 1);

    await fillAndNext(container, ANS[0]);
    await expectPosition(container, "en", 2);
    await fillAndNext(container, ANS[1]);
    await expectPosition(container, "en", 3);
    act(() => backBtn(container).click());
    await expectPosition(container, "en", 2);

    // Switch to TA *after* Back, *before* Save & Exit.
    act(() => langButton(container, "ta").click());
    await expectPosition(container, "ta", 2);

    await act(async () => {
      saveExitBtn(container, "ta").click();
    });

    await waitFor(() => expect(saveAnswers).toHaveBeenCalled());
    const lastCall = saveAnswers.mock.calls[saveAnswers.mock.calls.length - 1];
    const payload = lastCall[0]?.data as { language: Lang; answers: Record<string, unknown> };
    // Locked-in language is the most recent one — not the start one.
    expect(payload.language).toBe("ta");
    expect(payload.answers).toMatchObject({ q1: ANS[0], q2: ANS[1] });
  });
});
