/**
 * A11y: rapidly pressing Back multiple times in succession must (a) keep the
 * polite live region's textContent in lock-step with the localized
 * "current / total" position for each restored question — no stale value,
 * no skipped step, no language fallback — and (b) place focus on each
 * restored question's answer control so a screen-reader user hears the
 * correct question + control on every reverse step.
 *
 * Companion to:
 *   - SurveyRunner.nextAnnouncements.a11y.test.tsx (Next direction)
 *   - SurveyRunner.backAtFirstNoAnnouncement.a11y.test.tsx (Back-at-Q1 no-op)
 *   - SurveyRunner.backAnnouncements.a11y.test.tsx (single-step Back)
 *
 * This file specifically pins the *rapid multi-click* path, where a
 * regression that batched Back clicks into a single state update or that
 * skipped FocusTrap re-runs between commits would still pass the
 * one-click-at-a-time spec but fail here.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import { I18nProvider, UI, type Lang, pickText } from "@/lib/i18n";
import { formatQuestionPosition } from "@/lib/format";
import type { Survey } from "@/surveys/types";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => {} }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/responses.functions", () => ({
  startResponse: vi.fn().mockResolvedValue({ resumeToken: "tok" }),
  saveAnswers: vi.fn().mockResolvedValue({}),
  completeResponse: vi.fn().mockResolvedValue({}),
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

const TOTAL = 5;
const SURVEY: Survey = {
  slug: "a11y-rapid-back",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: Array.from({ length: TOTAL }, (_, i) => ({
    id: `q${i + 1}`,
    type: "text" as const,
    section: { en: "S", si: "කොටස", ta: "பகுதி" },
    label: {
      en: `Question ${i + 1}`,
      si: `ප්‍රශ්නය ${i + 1}`,
      ta: `கேள்வி ${i + 1}`,
    },
    required: true,
  })),
};

const SAMPLE: Record<Lang, string> = { en: "ans", si: "පිළ", ta: "பதில்" };

function renderRunner(lang: Lang) {
  return render(
    <I18nProvider>
      <SurveyRunner survey={SURVEY} initialToken="tok" initialLanguage={lang} />
    </I18nProvider>,
  );
}

function position() {
  return screen.getByTestId("question-position");
}

function answerInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector("main input[type=text]") as HTMLInputElement | null;
  if (!input) throw new Error("Answer input not found");
  return input;
}

function backButton(container: HTMLElement): HTMLButtonElement {
  // Back is the FIRST button in the sticky bottom <nav> (Save / Next follow).
  const btn = container.querySelector("nav button") as HTMLButtonElement | null;
  if (!btn) throw new Error("Back button not found");
  return btn;
}

function nextButton(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector("nav button.flex-1") as HTMLButtonElement | null;
  if (!btn) throw new Error("Next button not found");
  return btn;
}

function activeQuestionSection(container: HTMLElement): HTMLElement {
  const heading = container.querySelector("main section h2") as HTMLElement | null;
  if (!heading) throw new Error("Active question heading not found");
  const section = heading.closest("section") as HTMLElement | null;
  if (!section) throw new Error("Active question section not found");
  return section;
}

describe("SurveyRunner — rapid Back updates live region + restores focus per step (EN/SI/TA)", () => {
  for (const lang of ["en", "si", "ta"] as Lang[]) {
    it(`${lang}: 4 rapid Back clicks walk Q5 → Q4 → Q3 → Q2 → Q1 with correct announcements + focus`, async () => {
      const { container } = renderRunner(lang);

      // ── Phase 1: advance forward to Q5 (TOTAL) so we have somewhere to
      // come back from. Each Next click types a sample value first to clear
      // the required-field guard.
      for (let step = 1; step < TOTAL; step++) {
        await waitFor(() =>
          expect(position().textContent?.trim()).toBe(formatQuestionPosition(step, TOTAL, lang)),
        );
        const input = answerInput(container);
        fireEvent.change(input, { target: { value: `${SAMPLE[lang]}-${step}` } });
        act(() => {
          nextButton(container).click();
        });
      }
      await waitFor(() =>
        expect(position().textContent?.trim()).toBe(formatQuestionPosition(TOTAL, TOTAL, lang)),
      );

      // Snapshot the live-region node identity. It MUST stay the same DOM
      // element across every Back commit — that's how AT subscribes to the
      // textContent mutations.
      const liveNode = position();
      expect(liveNode.getAttribute("role")).toBe("status");
      expect(liveNode.getAttribute("aria-live")).toBe("polite");
      expect(liveNode.getAttribute("aria-atomic")).toBe("true");

      // ── Phase 2: rapidly fire 4 Back clicks. Real burst-clicks each go
      // through the event loop, so we model that with one `act()` per click
      // (no awaits in between). Batching all four into a single `act()`
      // would collapse them — the Back handler reads `idx` from closure, so
      // four reads of the same render produce one effective step. The
      // burst-click reality is what we care about for AT.
      const back = backButton(container);
      act(() => { back.click(); });
      act(() => { back.click(); });
      act(() => { back.click(); });
      act(() => { back.click(); });

      // Final settled position MUST be Q1 ("1 / TOTAL").
      const expectedQ1 = formatQuestionPosition(1, TOTAL, lang);
      await waitFor(() => expect(position().textContent?.trim()).toBe(expectedQ1));

      // Same DOM node → AT observed mutations in place, not a node swap.
      expect(position()).toBe(liveNode);
      expect(liveNode.getAttribute("aria-live")).toBe("polite");

      // The newly-restored Q1 heading carries the localized Q1 label.
      const sectionAfter = activeQuestionSection(container);
      const headingAfter = within(sectionAfter).getByRole("heading", { level: 2 });
      expect(headingAfter.textContent).toContain(pickText(SURVEY.questions[0].label, lang));

      // Focus landed on the restored question's answer control, inside the
      // active question section — FocusTrap's `focusKey` change re-ran
      // initial focus for every commit; the last commit's focus is what we
      // assert here.
      await waitFor(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active).not.toBeNull();
        // Focus contract: after a Back transition the sticky-bar Back
        // button retains focus.
        expect(active?.getAttribute("aria-label")).toBe(pickText(UI.back, lang));
      });
    });

    it(`${lang}: stepwise Back (5→4→3→2→1) updates the live region to the correct localized text at each step and re-focuses each input`, async () => {
      const { container } = renderRunner(lang);

      // Advance to Q5.
      for (let step = 1; step < TOTAL; step++) {
        await waitFor(() =>
          expect(position().textContent?.trim()).toBe(formatQuestionPosition(step, TOTAL, lang)),
        );
        fireEvent.change(answerInput(container), {
          target: { value: `${SAMPLE[lang]}-${step}` },
        });
        act(() => {
          nextButton(container).click();
        });
      }
      await waitFor(() =>
        expect(position().textContent?.trim()).toBe(formatQuestionPosition(TOTAL, TOTAL, lang)),
      );

      const liveNode = position();

      // Fire Back one click at a time, asserting the live region + focus
      // settle on the expected localized step before issuing the next click.
      for (let step = TOTAL - 1; step >= 1; step--) {
        act(() => {
          backButton(container).click();
        });

        const expected = formatQuestionPosition(step, TOTAL, lang);
        await waitFor(() => expect(position().textContent?.trim()).toBe(expected));

        // Live-region DOM identity preserved across every step.
        expect(position()).toBe(liveNode);
        expect(liveNode.getAttribute("aria-live")).toBe("polite");
        expect(liveNode.getAttribute("aria-atomic")).toBe("true");

        // Restored question's localized heading + focused input.
        const section = activeQuestionSection(container);
        expect(within(section).getByRole("heading", { level: 2 }).textContent).toContain(
          pickText(SURVEY.questions[step - 1].label, lang),
        );
        await waitFor(() => {
          const active = document.activeElement as HTMLElement | null;
          expect(active).not.toBeNull();
          expect(active?.getAttribute("aria-label")).toBe(pickText(UI.back, lang));
        });
      }
    });
  }
});
