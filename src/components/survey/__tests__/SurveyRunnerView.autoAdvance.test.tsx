import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SurveyRunnerView } from "@/components/survey/SurveyRunnerView";
import type { Survey } from "@/surveys/types";

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

const SURVEY: Survey = {
  slug: "auto",
  title: { en: "Auto", si: "Auto", ta: "Auto" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "single_choice",
      section: { en: "Section", si: "Section", ta: "Section" },
      label: { en: "Pick one", si: "Pick one", ta: "Pick one" },
      options: [
        { value: "a", label: { en: "Option A", si: "Option A", ta: "Option A" } },
        { value: "b", label: { en: "Option B", si: "Option B", ta: "Option B" } },
      ],
    },
  ],
};

function Harness({ onAutoAdvance }: { onAutoAdvance: () => void }) {
  const nextRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  return (
    <SurveyRunnerView
      survey={SURVEY}
      lang="en"
      stage="questions"
      visible={SURVEY.questions}
      current={SURVEY.questions[0]}
      idx={0}
      pct={0}
      skippedCount={0}
      answers={{}}
      consent={{}}
      contact={{ name: "", email: "", organization: "" }}
      busy={false}
      token="tok"
      verifyError={null}
      navDirection={1}
      validationError={null}
      nextButtonRef={nextRef}
      backButtonRef={backRef}
      swipeHandlers={{}}
      onStart={() => {}}
      onRequiredConsentAccepted={() => {}}
      onOptionalConsentToggle={() => {}}
      onOptionalBack={() => {}}
      onOptionalContinue={async () => {}}
      onRetryVerify={async () => {}}
      onBypassVerify={async () => {}}
      onEdit={() => {}}
      onQuestionChange={() => {}}
      onAutoAdvance={onAutoAdvance}
      onReviewContinue={() => {}}
      onContactChange={() => {}}
      onContactBack={() => {}}
      onSubmit={() => {}}
      onQuestionBack={() => {}}
      onManualSave={() => {}}
      onQuestionNext={() => {}}
    />
  );
}

describe("SurveyRunnerView auto-advance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("waits 500ms after pointer choice selection before auto-advancing", () => {
    const onAutoAdvance = vi.fn();
    render(<Harness onAutoAdvance={onAutoAdvance} />);

    const option = screen.getByRole("radio", { name: /Option A/ });
    fireEvent.pointerDown(option);
    fireEvent.click(option);

    vi.advanceTimersByTime(499);
    expect(onAutoAdvance).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onAutoAdvance).toHaveBeenCalledTimes(1);
  });

  it("does not auto-advance keyboard choice selection", () => {
    const onAutoAdvance = vi.fn();
    render(<Harness onAutoAdvance={onAutoAdvance} />);

    const option = screen.getByRole("radio", { name: /Option A/ });
    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.click(option);
    vi.advanceTimersByTime(600);

    expect(onAutoAdvance).not.toHaveBeenCalled();
  });
});
