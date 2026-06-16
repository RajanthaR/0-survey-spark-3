import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { I18nProvider } from "@/lib/i18n";
import { QuestionView } from "@/components/survey/QuestionView";
import { pairwiseAllPairsComplete, validateAnswerCode } from "@/components/survey/validation";
import { expandSurveySteps, type SurveyStep } from "@/components/survey/runner-steps";
import type { Question } from "@/surveys/types";

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const cache = new Map<string, React.ForwardRefExoticComponent<Record<string, unknown>>>();
  const passthrough = (tag: string) => {
    const hit = cache.get(tag);
    if (hit) return hit;
    const component = React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) =>
      React.createElement(tag, { ...props, ref }),
    );
    cache.set(tag, component);
    return component;
  };
  return {
    motion: new Proxy({}, { get: (_t, key: string) => passthrough(key) }),
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

const Q_ONE_PAIR: Question = {
  id: "ahp",
  type: "pairwise_saaty",
  required: true,
  section: { en: "Section", si: "අංශය", ta: "பிரிவு" },
  label: { en: "Compare", si: "සසඳන්න", ta: "ஒப்பிடு" },
  criteria: [
    { key: "A", label: { en: "Alpha", si: "ඇල්ෆා", ta: "ஆல்பா" } },
    { key: "B", label: { en: "Beta", si: "බීටා", ta: "பீட்டா" } },
  ],
};

const Q_THREE_PAIRS: Question = {
  ...Q_ONE_PAIR,
  criteria: [...Q_ONE_PAIR.criteria!, { key: "C", label: { en: "Gamma", si: "ගැමා", ta: "காமா" } }],
};

function renderPairwise(value: unknown, onChange = () => {}, q: SurveyStep = Q_ONE_PAIR) {
  return render(
    <I18nProvider initialLang="en">
      <QuestionView q={q} value={value} onChange={onChange} error={null} />
    </I18nProvider>,
  );
}

function StatefulPairwise({ q = Q_ONE_PAIR, initial = {} }: { q?: SurveyStep; initial?: unknown }) {
  const [value, setValue] = useState(initial);
  return (
    <I18nProvider initialLang="en">
      <QuestionView q={q} value={value} onChange={setValue} error={null} />
    </I18nProvider>
  );
}

describe("QuestionView pairwise (AHP) forced-choice two-step interaction", () => {
  it("renders one comparison at a time and does not offer an equal choice", () => {
    renderPairwise({}, undefined, Q_THREE_PAIRS);

    expect(screen.getByText("Comparison 1 of 3")).toBeInTheDocument();
    expect(screen.getByTestId("pair-A__B")).toBeInTheDocument();
    expect(screen.queryByTestId("pair-A__C")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pair-A__B-choice-eq")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous comparison" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next comparison" })).not.toBeInTheDocument();
  });

  it("renders the pair assigned by a synthetic runner step", () => {
    const steps = expandSurveySteps([Q_THREE_PAIRS]);

    renderPairwise({}, undefined, steps[1]);

    expect(screen.getByText("Comparison 2 of 3")).toBeInTheDocument();
    expect(screen.getByTestId("pair-A__C")).toBeInTheDocument();
    expect(screen.queryByTestId("pair-A__B")).not.toBeInTheDocument();
  });

  it("step 1: choosing a winner records a pending (unrated) code and reveals the rating step", () => {
    const onChange = vi.fn();
    const { unmount } = renderPairwise({}, onChange);

    fireEvent.click(screen.getByTestId("pair-A__B-choice-a"));
    expect(onChange).toHaveBeenCalledWith({ A__B: "a" });

    unmount();
    render(<StatefulPairwise />);
    fireEvent.click(screen.getByTestId("pair-A__B-choice-a"));
    expect(screen.getByTestId("pair-A__B-rating")).toBeInTheDocument();
  });

  it("step 2: rating a selected winner encodes side + 1..9 rating", () => {
    const onChange = vi.fn();
    renderPairwise({ A__B: "b" }, onChange);

    fireEvent.click(screen.getByTestId("pair-A__B-rating-8"));
    expect(onChange).toHaveBeenCalledWith({ A__B: "b8" });
  });

  it("updates the rating meaning text as the respondent selects a number", () => {
    render(<StatefulPairwise />);

    fireEvent.click(screen.getByTestId("pair-A__B-choice-a"));
    expect(screen.getByTestId("pair-A__B-rating-meaning")).toHaveTextContent("Move the slider");

    fireEvent.click(screen.getByTestId("pair-A__B-rating-8"));
    expect(screen.getByTestId("pair-A__B-rating-meaning")).toHaveTextContent("8: Very strong");
  });

  it("does not render in-card comparison navigation buttons", () => {
    render(<StatefulPairwise q={Q_THREE_PAIRS} />);

    expect(screen.queryByRole("button", { name: "Previous comparison" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next comparison" })).not.toBeInTheDocument();
  });
});

describe("pairwise completeness validation", () => {
  it("treats a winner without a strength as incomplete", () => {
    expect(pairwiseAllPairsComplete(Q_ONE_PAIR, { A__B: "a" })).toBe(false);
    expect(validateAnswerCode(Q_ONE_PAIR, { A__B: "a" })).toEqual({ code: "ratePairs" });
  });

  it("treats any rated winner from 1 to 9 as complete", () => {
    expect(pairwiseAllPairsComplete(Q_ONE_PAIR, { A__B: "a1" })).toBe(true);
    expect(pairwiseAllPairsComplete(Q_ONE_PAIR, { A__B: "b9" })).toBe(true);
    expect(validateAnswerCode(Q_ONE_PAIR, { A__B: "b7" })).toBeNull();
  });

  it("rejects the removed equal code", () => {
    expect(pairwiseAllPairsComplete(Q_ONE_PAIR, { A__B: "eq" })).toBe(false);
    expect(validateAnswerCode(Q_ONE_PAIR, { A__B: "eq" })).toEqual({ code: "ratePairs" });
  });

  it("does not error on an untouched (empty) grid — the required gate handles that", () => {
    expect(validateAnswerCode(Q_ONE_PAIR, {})).toBeNull();
  });

  it("requires every generated pair to be complete", () => {
    expect(pairwiseAllPairsComplete(Q_THREE_PAIRS, { A__B: "a5" })).toBe(false);
    expect(
      pairwiseAllPairsComplete(Q_THREE_PAIRS, {
        A__B: "a5",
        A__C: "b1",
        B__C: "a9",
      }),
    ).toBe(true);
  });
});
