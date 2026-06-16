import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { QuestionMap } from "@/components/survey/QuestionMap";
import { expandSurveySteps } from "@/components/survey/runner-steps";
import type { Survey } from "@/surveys/types";

const SURVEY: Survey = {
  slug: "pairwise-map",
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
      label: {
        en: "For each pair, choose the more important factor.",
        si: "For each pair, choose the more important factor.",
        ta: "For each pair, choose the more important factor.",
      },
      criteria: [
        { key: "A", label: { en: "Alpha", si: "Alpha", ta: "Alpha" } },
        { key: "B", label: { en: "Beta", si: "Beta", ta: "Beta" } },
        { key: "C", label: { en: "Gamma", si: "Gamma", ta: "Gamma" } },
      ],
    },
  ],
};

describe("QuestionMap pairwise steps", () => {
  it("labels expanded pairwise steps by comparison and criteria", () => {
    const steps = expandSurveySteps(SURVEY.questions);

    render(
      <QuestionMap
        survey={SURVEY}
        answers={{}}
        visible={steps}
        lang="en"
        currentId={steps[0]?.id}
        onJump={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("question-map-trigger"));

    expect(screen.getByTestId(`question-map-item-${steps[0]?.id}`)).toHaveTextContent(
      "Comparison 1 of 3: Alpha / Beta",
    );
    expect(screen.getByTestId(`question-map-item-${steps[1]?.id}`)).toHaveTextContent(
      "Comparison 2 of 3: Alpha / Gamma",
    );
    expect(screen.getByTestId(`question-map-item-${steps[2]?.id}`)).toHaveTextContent(
      "Comparison 3 of 3: Beta / Gamma",
    );
    expect(screen.queryByText("For each pair, choose the more important factor.")).toBeNull();
  });
});
