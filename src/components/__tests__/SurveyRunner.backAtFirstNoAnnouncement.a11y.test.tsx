/**
 * A11y: at the first question, the Back button is a no-op AND must not
 * disturb the screen-reader experience — pressing it (or trying to) must
 * NOT re-announce a question change and must NOT steal focus away from the
 * answer control. Companion to `SurveyRunner.nextAnnouncements.a11y.test.tsx`
 * (which proves Next *does* announce); this spec proves Back-at-Q1 does
 * *not*. Runs across EN / SI / TA so a regression in any locale fails per
 * language.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { I18nProvider, type Lang, pickText } from "@/lib/i18n";
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

const TOTAL = 3;
const SURVEY: Survey = {
  slug: "a11y-back-noop-q1",
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

function backButton(container: HTMLElement): HTMLButtonElement {
  // Back is the first <button> in the sticky bottom <nav> (Save / Next follow).
  const btn = container.querySelector("nav button") as HTMLButtonElement | null;
  if (!btn) throw new Error("Back button not found");
  return btn;
}

function answerInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector("main input[type=text]") as HTMLInputElement | null;
  if (!input) throw new Error("Answer input not found");
  return input;
}

describe("SurveyRunner — Back at Q1 is a silent no-op (EN/SI/TA)", () => {
  for (const lang of ["en", "si", "ta"] as Lang[]) {
    it(`${lang}: Back is disabled, no announcement, focus stays on the answer control`, async () => {
      const { container } = renderRunner(lang);

      // Wait until the runner has settled on Q1 with the localized position
      // text — this also confirms the live region wiring is the same node we
      // will re-check after the Back attempt.
      const expectedQ1 = formatQuestionPosition(1, TOTAL, lang);
      await waitFor(() => expect(position().textContent?.trim()).toBe(expectedQ1));

      const liveNode = position();
      expect(liveNode.getAttribute("role")).toBe("status");
      expect(liveNode.getAttribute("aria-live")).toBe("polite");
      expect(liveNode.getAttribute("aria-atomic")).toBe("true");

      // Move focus onto the answer control (this is where FocusTrap lands a
      // keyboard user on Q1 anyway, but we focus explicitly so the assertion
      // is independent of FocusTrap's initial-focus race).
      const input = answerInput(container);
      act(() => input.focus());
      expect(document.activeElement).toBe(input);

      // The Back button at Q1 MUST be disabled — the announcement-suppression
      // contract piggybacks on the click being a no-op.
      const back = backButton(container);
      expect(back.disabled).toBe(true);
      expect(back.getAttribute("aria-label")).toBeTruthy();

      // Attempt to click Back anyway. A disabled <button> swallows the
      // synthetic click, but we verify behaviorally: no state change, no
      // re-announcement, no focus theft.
      act(() => {
        fireEvent.click(back);
      });
      // Let any pending effects flush.
      await Promise.resolve();

      // (a) No question change: the rendered <h2> still shows Q1's label and
      // the live region still reads "1 / total" in the active language. Same
      // DOM node identity → AT did not get a textContent mutation event.
      expect(position()).toBe(liveNode);
      expect(position().textContent?.trim()).toBe(expectedQ1);
      const heading = container.querySelector("main section h2");
      expect(heading?.textContent ?? "").toContain(pickText(SURVEY.questions[0].label, lang));

      // (b) Focus stayed on the answer control — the disabled Back click did
      // not move focus to itself or anywhere else.
      expect(document.activeElement).toBe(input);
    });
  }
});
