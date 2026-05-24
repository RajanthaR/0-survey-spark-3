/**
 * A11y: when the user presses Next, screen readers must hear BOTH
 *   (a) the localized progress header re-announce ("Question N of M" /
 *       "ප්‍රශ්න N / M" / "கேள்விகள் N / M") via the polite live region on
 *       `<QuestionPosition data-testid="question-position">`, and
 *   (b) the new question itself — by way of focus moving into the new
 *       question section so the AT speaks the newly-focused control along
 *       with its surrounding `<h2>` localized question label.
 *
 * The progress-only wiring is also covered by
 * `SurveyRunner.progressAnnouncements.e2e.test.tsx`; this spec adds the
 * companion question-change assertion and runs the full pair across EN /
 * SI / TA so a regression in either announcement path fails per language.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
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

const TOTAL = 4;
const SURVEY: Survey = {
  slug: "a11y-next-announcements",
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

function clickNext(container: HTMLElement, value: string) {
  const input = container.querySelector("main input[type=text]") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  const nextBtn = container.querySelector("nav button.flex-1") as HTMLButtonElement;
  if (!nextBtn) throw new Error("Next button not found");
  act(() => {
    nextBtn.click();
  });
}

function activeQuestionSection(container: HTMLElement): HTMLElement {
  // Each step's wrapper is the <section> that contains the question <h2>.
  // It's the closest section ancestor of the rendered question heading.
  const heading = container.querySelector("main section h2") as HTMLElement | null;
  if (!heading) throw new Error("Active question heading not found");
  const section = heading.closest("section") as HTMLElement | null;
  if (!section) throw new Error("Active question section not found");
  return section;
}

describe("SurveyRunner — Next click announces both progress + new question (EN/SI/TA)", () => {
  for (const lang of ["en", "si", "ta"] as Lang[]) {
    it(`${lang}: live region updates AND focus moves into the new question on each Next`, async () => {
      const { container } = renderRunner(lang);

      // (a) Live-region wiring on the position node — the same element a
      // screen reader subscribes to. Verified per advance.
      const liveNode = position();
      expect(liveNode.getAttribute("role")).toBe("status");
      expect(liveNode.getAttribute("aria-live")).toBe("polite");
      expect(liveNode.getAttribute("aria-atomic")).toBe("true");

      for (let step = 1; step < TOTAL; step++) {
        // Position text BEFORE Next must equal the localized "step / total".
        await waitFor(() =>
          expect(position().textContent?.trim()).toBe(formatQuestionPosition(step, TOTAL, lang)),
        );

        // The currently-rendered <h2> must carry the localized question label
        // for question `step` (so the heading screen readers will read in
        // context of the focused control is the right one).
        const sectionBefore = activeQuestionSection(container);
        const headingBefore = within(sectionBefore).getByRole("heading", { level: 2 });
        expect(headingBefore.textContent).toContain(
          pickText(SURVEY.questions[step - 1].label, lang),
        );

        clickNext(container, `${SAMPLE[lang]}-${step}`);

        // (a) Live region MUST re-announce the new localized position. Same
        // DOM node identity → AT observes the textContent mutation.
        await waitFor(() =>
          expect(position().textContent?.trim()).toBe(
            formatQuestionPosition(step + 1, TOTAL, lang),
          ),
        );
        expect(position()).toBe(liveNode);
        expect(liveNode.getAttribute("aria-live")).toBe("polite");

        // (b) Question-change announcement: the new question's heading is
        // rendered (so AT can read it) AND focus has moved into the new
        // section (so AT speaks the focused control plus its heading
        // context). FocusTrap re-runs initial focus on `focusKey` change.
        await waitFor(() => {
          const sectionAfter = activeQuestionSection(container);
          const headingAfter = within(sectionAfter).getByRole("heading", { level: 2 });
          expect(headingAfter.textContent).toContain(pickText(SURVEY.questions[step].label, lang));
          // Focus contract: after a forward transition focus moves into
          // the new question so screen-reader users hear the changed prompt.
          const active = document.activeElement as HTMLElement | null;
          expect(active).not.toBeNull();
          expect(sectionAfter.contains(active)).toBe(true);
          expect(active?.tagName).toBe("INPUT");
        });
      }
    }, 10_000);
  }

  it("the announced progress strings are genuinely localized (no EN fallback)", () => {
    const en = formatQuestionPosition(2, TOTAL, "en");
    const si = formatQuestionPosition(2, TOTAL, "si");
    const ta = formatQuestionPosition(2, TOTAL, "ta");
    expect(new Set([en, si, ta]).size).toBe(3);
    expect(si.startsWith("ප්‍රශ්න")).toBe(true);
    expect(ta.startsWith("கேள்விகள்")).toBe(true);
  });
});
