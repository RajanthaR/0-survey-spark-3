import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { SurveyRunnerView } from "@/components/survey/SurveyRunnerView";
import { I18nProvider } from "@/lib/i18n";
import type { Question, Survey } from "@/surveys/types";

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

const PAIRWISE_QUESTION: Question = {
  id: "ahp",
  type: "pairwise_saaty",
  required: true,
  section: { en: "Section", si: "අංශය", ta: "பிரிவு" },
  label: { en: "Compare", si: "සසඳන්න", ta: "ஒப்பிடு" },
  criteria: [
    { key: "A", label: { en: "Alpha", si: "ඇල්ෆා", ta: "ஆல்பா" } },
    { key: "B", label: { en: "Beta", si: "බීටා", ta: "பீட்டா" } },
    { key: "C", label: { en: "Gamma", si: "ගැමා", ta: "காமா" } },
  ],
};

const SURVEY: Survey = {
  slug: "pairwise-footer",
  title: { en: "Pairwise", si: "Pairwise", ta: "Pairwise" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [PAIRWISE_QUESTION],
};

function Harness({
  answers,
  question = PAIRWISE_QUESTION,
}: {
  answers: Record<string, unknown>;
  question?: Question;
}) {
  const nextRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const survey: Survey = { ...SURVEY, questions: [question] };

  return (
    <I18nProvider initialLang="en">
      <SurveyRunnerView
        survey={survey}
        lang="en"
        stage="questions"
        visible={survey.questions}
        current={question}
        idx={0}
        pct={0}
        skippedCount={0}
        answers={answers}
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
        onAutoAdvance={() => {}}
        onReviewContinue={() => {}}
        onContactChange={() => {}}
        onContactBack={() => {}}
        onSubmit={() => {}}
        onQuestionBack={() => {}}
        onManualSave={() => {}}
        onQuestionNext={() => {}}
      />
    </I18nProvider>
  );
}

describe("SurveyRunnerView pairwise footer", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hides the global Next button while the pairwise question is untouched", () => {
    render(<Harness answers={{}} />);

    expect(screen.queryByTestId("next-button")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save & exit" })).toBeInTheDocument();
  });

  it("keeps the global Next button hidden until every pair is rated", () => {
    render(<Harness answers={{ ahp: { A__B: "a5" } }} />);

    expect(screen.queryByTestId("next-button")).not.toBeInTheDocument();
  });

  it("shows the global Next button once every pair is rated", () => {
    render(
      <Harness
        answers={{
          ahp: {
            A__B: "a5",
            A__C: "b1",
            B__C: "a9",
          },
        }}
      />,
    );

    expect(screen.getByTestId("next-button")).toBeInTheDocument();
  });

  it("shows the global Next button for an optional untouched pairwise question", () => {
    render(<Harness answers={{}} question={{ ...PAIRWISE_QUESTION, required: false }} />);

    expect(screen.getByTestId("next-button")).toBeInTheDocument();
  });
});
