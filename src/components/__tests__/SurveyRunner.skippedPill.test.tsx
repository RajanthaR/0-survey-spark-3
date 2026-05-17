/**
 * The progress header shows a localized "+N skipped" pill when the
 * position counter jumps forward by more than one (i.e. next-unanswered
 * skipping landed past one or more answered questions). The pill is a
 * polite live region so screen-reader users hear it too. It auto-clears
 * after a short delay and never appears when nothing was skipped.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, act, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
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

const SURVEY: Survey = {
  slug: "skipped-pill",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: Array.from({ length: 5 }, (_, i) => ({
    id: `q${i + 1}`,
    type: "text" as const,
    section: { en: "S", si: "S", ta: "S" },
    label: { en: `Q${i + 1}`, si: `Q${i + 1}`, ta: `Q${i + 1}` },
    required: false,
  })),
};

function clickNext(container: HTMLElement) {
  const btn = container.querySelector("nav button.flex-1") as HTMLButtonElement;
  act(() => btn.click());
}
function type(container: HTMLElement, v: string) {
  const input = container.querySelector("input[type=text]") as HTMLInputElement;
  fireEvent.change(input, { target: { value: v } });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("SurveyRunner — skipped progress pill", () => {
  it("shows '+N skipped' when Next jumps past answered questions, then auto-clears", async () => {
    // Pre-answer q2 and q3 so Next from q1 lands on q4 (skipping 2).
    const { container } = render(
      <I18nProvider>
        <SurveyRunner
          survey={SURVEY}
          initialToken="tok"
          initialAnswers={{ q2: "x", q3: "y" }}
          initialLanguage="en"
        />
      </I18nProvider>,
    );
    type(container, "a");
    clickNext(container);

    // Header advanced to "Question 4 of 5" and the skip pill appears.
    await waitFor(() => {
      expect(container.querySelector('[data-testid="question-position"]')!.textContent).toBe(
        "Question 4 of 5",
      );
    });
    const pill = await waitFor(() => {
      const el = container.querySelector('[data-testid="skipped-pill"]');
      if (!el) throw new Error("pill not rendered");
      return el as HTMLElement;
    });
    expect(pill.textContent).toBe("+2 skipped");
    expect(pill.getAttribute("aria-live")).toBe("polite");

    // Auto-clears after the timeout.
    await waitFor(
      () => {
        expect(container.querySelector('[data-testid="skipped-pill"]')).toBeNull();
      },
      { timeout: 2500 },
    );
  });

  it("does NOT render the pill on a normal one-step advance", async () => {
    const { container } = render(
      <I18nProvider>
        <SurveyRunner survey={SURVEY} initialToken="tok" initialLanguage="en" />
      </I18nProvider>,
    );
    type(container, "a");
    clickNext(container);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="question-position"]')!.textContent).toBe(
        "Question 2 of 5",
      );
    });
    // Give state a moment to settle and assert no pill appeared.
    await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector('[data-testid="skipped-pill"]')).toBeNull();
  });

  it("localizes the skipped pill: Sinhala uses 'මඟ හරින ලදී', Tamil uses 'தவிர்க்கப்பட்டது'", async () => {
    for (const { lang, suffix } of [
      { lang: "si" as const, suffix: "මඟ හරින ලදී" },
      { lang: "ta" as const, suffix: "தவிர்க்கப்பட்டது" },
    ]) {
      const { container, unmount } = render(
        <I18nProvider>
          <SurveyRunner
            survey={SURVEY}
            initialToken="tok"
            initialAnswers={{ q2: "x", q3: "y" }}
            initialLanguage={lang}
          />
        </I18nProvider>,
      );
      type(container, "a");
      clickNext(container);
      const pill = await waitFor(() => {
        const el = container.querySelector('[data-testid="skipped-pill"]');
        if (!el) throw new Error("pill not rendered");
        return el as HTMLElement;
      });
      expect(pill.textContent).toBe(`+2 ${suffix}`);
      unmount();
    }
  });
});
