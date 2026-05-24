/**
 * The progress header shows a localized "+N skipped" pill when the
 * position counter jumps forward by more than one. The pill is a polite
 * live region so screen-reader users hear it too. It auto-clears after a
 * short delay and never appears on normal adjacent Next navigation.
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
  it("shows '+N skipped' when a shortcut jumps past intermediate questions, then auto-clears", async () => {
    const { container } = render(
      <I18nProvider>
        <SurveyRunner survey={SURVEY} initialToken="tok" initialLanguage="en" />
      </I18nProvider>,
    );
    act(() => {
      fireEvent.keyDown(window, { key: "End" });
    });

    await waitFor(() => {
      expect(container.querySelector('[data-testid="question-position"]')!.textContent).toBe(
        "Question 5 of 5",
      );
    });
    const pill = await waitFor(() => {
      const el = container.querySelector('[data-testid="skipped-pill"]');
      if (!el) throw new Error("pill not rendered");
      return el as HTMLElement;
    });
    expect(pill.textContent).toBe("+3 skipped");
    expect(pill.getAttribute("aria-live")).toBe("polite");

    await waitFor(
      () => {
        expect(container.querySelector('[data-testid="skipped-pill"]')).toBeNull();
      },
      { timeout: 2500 },
    );
  });

  it("does NOT render the pill on adjacent Next even when later questions are answered", async () => {
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
    await waitFor(() => {
      expect(container.querySelector('[data-testid="question-position"]')!.textContent).toBe(
        "Question 2 of 5",
      );
    });
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
          <SurveyRunner survey={SURVEY} initialToken="tok" initialLanguage={lang} />
        </I18nProvider>,
      );
      act(() => {
        fireEvent.keyDown(window, { key: "End" });
      });
      const pill = await waitFor(() => {
        const el = container.querySelector('[data-testid="skipped-pill"]');
        if (!el) throw new Error("pill not rendered");
        return el as HTMLElement;
      });
      expect(pill.textContent).toBe(`+3 ${suffix}`);
      unmount();
    }
  });
});
