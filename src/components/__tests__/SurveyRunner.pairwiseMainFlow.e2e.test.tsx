import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { I18nProvider, UI, pickText } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

const saveAnswers = vi.fn().mockResolvedValue({});
vi.mock("@/lib/responses.functions", () => ({
  startResponse: vi.fn().mockResolvedValue({ resumeToken: "tok" }),
  saveAnswers: (...args: unknown[]) => saveAnswers(...args),
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
    motion: new Proxy({}, { get: (_target, key: string) => passthrough(key) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => false,
  };
});

vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { SurveyRunner } from "@/components/SurveyRunner";

const SURVEY: Survey = {
  slug: "pairwise-main-flow",
  title: { en: "Pairwise", si: "Pairwise", ta: "Pairwise" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "ahp",
      type: "pairwise_saaty",
      required: true,
      section: { en: "AHP", si: "AHP", ta: "AHP" },
      label: { en: "Compare", si: "සසඳන්න", ta: "ஒப்பிடு" },
      criteria: [
        { key: "A", label: { en: "Alpha", si: "ඇල්ෆා", ta: "ஆல்பா" } },
        { key: "B", label: { en: "Beta", si: "බීටා", ta: "பீட்டா" } },
        { key: "C", label: { en: "Gamma", si: "ගැමා", ta: "காமா" } },
      ],
    },
    {
      id: "after",
      type: "text",
      section: { en: "Next", si: "Next", ta: "Next" },
      label: { en: "Next normal question", si: "Next normal question", ta: "Next normal question" },
      required: false,
    },
  ],
};

function renderRunner() {
  return render(
    <I18nProvider initialLang="en">
      <SurveyRunner survey={SURVEY} initialLanguage="en" initialToken="tok" />
    </I18nProvider>,
  );
}

function nextButton(): HTMLButtonElement {
  return screen.getByTestId("next-button") as HTMLButtonElement;
}

function rateActivePair(pairKey: string, side: "a" | "b", rating: number) {
  fireEvent.click(screen.getByTestId(`pair-${pairKey}-choice-${side}`));
  fireEvent.click(screen.getByTestId(`pair-${pairKey}-rating-${rating}`));
}

function goNext() {
  fireEvent.click(nextButton());
}

describe("SurveyRunner pairwise main flow", () => {
  it("expands pairwise comparisons into blocked green-Next runner steps", () => {
    saveAnswers.mockClear();
    renderRunner();

    expect(screen.getByTestId("question-position")).toHaveTextContent("Question 1 of 4");
    expect(screen.getByTestId("question-map-trigger")).toHaveTextContent("0/4");
    expect(screen.getByText("Comparison 1 of 3")).toBeInTheDocument();
    expect(screen.getByTestId("pair-A__B")).toBeInTheDocument();
    expect(nextButton()).toHaveAttribute("aria-disabled", "true");

    rateActivePair("A__B", "a", 5);
    expect(nextButton()).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByTestId("question-map-trigger")).toHaveTextContent("1/4");

    goNext();
    expect(screen.getByTestId("question-position")).toHaveTextContent("Question 2 of 4");
    expect(screen.getByText("Comparison 2 of 3")).toBeInTheDocument();
    expect(screen.getByTestId("pair-A__C")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("question-position")).toHaveTextContent("Question 1 of 4");
    expect(screen.getByTestId("pair-A__B")).toBeInTheDocument();
  }, 10_000);

  it("advances through each pair and stores answers under the parent pairwise id", async () => {
    saveAnswers.mockClear();
    renderRunner();

    rateActivePair("A__B", "a", 5);
    goNext();
    rateActivePair("A__C", "b", 1);
    goNext();
    expect(screen.getByTestId("question-position")).toHaveTextContent("Question 3 of 4");
    expect(screen.getByText("Comparison 3 of 3")).toBeInTheDocument();
    expect(screen.getByTestId("pair-B__C")).toBeInTheDocument();

    rateActivePair("B__C", "a", 9);
    goNext();
    expect(screen.getByTestId("question-position")).toHaveTextContent("Question 4 of 4");
    expect(screen.getByTestId("question-map-trigger")).toHaveTextContent("3/4");
    expect(screen.getByRole("heading", { name: "Next normal question" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: pickText(UI.saveExit, "en") }));
    await waitFor(() => expect(saveAnswers).toHaveBeenCalled());
    expect(saveAnswers.mock.calls.at(-1)?.[0]).toMatchObject({
      data: {
        answers: {
          ahp: {
            A__B: "a5",
            A__C: "b1",
            B__C: "a9",
          },
        },
      },
    });
  }, 10_000);
});
