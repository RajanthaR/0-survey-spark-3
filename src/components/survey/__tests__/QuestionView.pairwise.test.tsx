import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { I18nProvider } from "@/lib/i18n";
import { QuestionView } from "@/components/survey/QuestionView";
import { pairwiseAllPairsComplete, validateAnswerCode } from "@/components/survey/validation";
import type { Question } from "@/surveys/types";

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

const Q: Question = {
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

function renderPairwise(value: unknown, onChange = () => {}) {
  return render(
    <I18nProvider initialLang="en">
      <QuestionView q={Q} value={value} onChange={onChange} error={null} />
    </I18nProvider>,
  );
}

describe("QuestionView pairwise (AHP) two-step interaction", () => {
  it("hides the strength step until a winner is chosen", () => {
    renderPairwise({});
    expect(screen.queryByTestId("pair-A__B-strength")).not.toBeInTheDocument();
  });

  it("step 1: choosing a winner records a pending (unrated) code and reveals the rating step", () => {
    const onChange = vi.fn();
    renderPairwise({}, onChange);

    fireEvent.click(screen.getByTestId("pair-A__B-choice-a"));
    expect(onChange).toHaveBeenCalledWith({ A__B: "a" });
  });

  it("shows the strength step once a side is selected", () => {
    renderPairwise({ A__B: "a" });
    expect(screen.getByTestId("pair-A__B-strength")).toBeInTheDocument();
  });

  it("step 2: rating a selected winner encodes side + strength", () => {
    const onChange = vi.fn();
    renderPairwise({ A__B: "a" }, onChange);

    fireEvent.click(screen.getByTestId("pair-A__B-strength-5"));
    expect(onChange).toHaveBeenCalledWith({ A__B: "a5" });
  });

  it("'equally important' completes the pair without a strength step", () => {
    const onChange = vi.fn();
    renderPairwise({}, onChange);

    fireEvent.click(screen.getByTestId("pair-A__B-choice-eq"));
    expect(onChange).toHaveBeenCalledWith({ A__B: "eq" });
  });
});

describe("pairwise completeness validation", () => {
  it("treats a winner without a strength as incomplete", () => {
    expect(pairwiseAllPairsComplete(Q, { A__B: "a" })).toBe(false);
    expect(validateAnswerCode(Q, { A__B: "a" })).toEqual({ code: "ratePairs" });
  });

  it("treats a rated winner or 'equal' as complete", () => {
    expect(pairwiseAllPairsComplete(Q, { A__B: "a5" })).toBe(true);
    expect(pairwiseAllPairsComplete(Q, { A__B: "eq" })).toBe(true);
    expect(validateAnswerCode(Q, { A__B: "b7" })).toBeNull();
  });

  it("does not error on an untouched (empty) grid — the required gate handles that", () => {
    expect(validateAnswerCode(Q, {})).toBeNull();
  });
});
