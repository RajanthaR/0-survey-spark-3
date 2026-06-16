/**
 * D25 — accessibility audit on the review screen.
 *
 * Asserts the structural a11y contract that screen reader users depend on
 * before submitting the survey:
 *   1. heading order: a single `h2` (review title) followed by one `h3`
 *      per section. No skipped levels.
 *   2. the missing-required banner is announced via `role="status"` +
 *      `aria-live="polite"` so the count change is read without stealing
 *      focus.
 *   3. every per-question Edit affordance has an `aria-label` (icon-only
 *      buttons must not be unlabeled).
 *   4. clicking Edit fires the `onEdit(questionId)` callback so focus
 *      management higher up can return the user to the right question.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nProvider, UI, pickText } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

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

import { ReviewPanel } from "@/components/survey/ReviewPanel";

const SURVEY: Survey = {
  slug: "a11y-review",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      required: true,
      section: { en: "Section A", si: "Section A", ta: "Section A" },
      label: { en: "Name", si: "නම", ta: "பெயர்" },
    },
    {
      id: "q2",
      type: "text",
      required: false,
      section: { en: "Section B", si: "Section B", ta: "Section B" },
      label: { en: "Notes", si: "සටහන්", ta: "குறிப்புகள்" },
    },
  ],
};

function setup(answers: Record<string, unknown>, onEdit = vi.fn()) {
  const onContinue = vi.fn();
  render(
    <I18nProvider>
      <ReviewPanel
        survey={SURVEY}
        answers={answers}
        lang="en"
        onEdit={onEdit}
        onContinue={onContinue}
      />
    </I18nProvider>,
  );
  return { onEdit, onContinue };
}

describe("ReviewPanel — a11y", () => {
  it("renders a single h2 review title followed by one h3 per section", () => {
    setup({ q1: "Asha", q2: "" });
    const h2s = screen.getAllByRole("heading", { level: 2 });
    const h3s = screen.getAllByRole("heading", { level: 3 });
    expect(h2s).toHaveLength(1);
    expect(h2s[0]).toHaveTextContent(pickText(UI.reviewTitle, "en"));
    expect(h3s.map((h) => h.textContent)).toEqual(["Section A", "Section B"]);
  });

  it("announces missing-required count via aria-live polite", () => {
    setup({ q1: "" }); // q1 is required and empty
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(banner.textContent).toMatch(/1\s/);
  });

  it("does not render the missing-required banner when nothing is missing", () => {
    setup({ q1: "Asha", q2: "" }); // q2 is optional
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("labels every per-question Edit button with aria-label", () => {
    setup({ q1: "Asha", q2: "" });
    const editLabel = pickText(UI.edit, "en");
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label") === editLabel);
    expect(editButtons.length).toBe(SURVEY.questions.length);
  });

  it("invokes onEdit with the question id when Edit is clicked", () => {
    const { onEdit } = setup({ q1: "Asha", q2: "" });
    const editLabel = pickText(UI.edit, "en");
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label") === editLabel);
    fireEvent.click(editButtons[0]);
    expect(onEdit).toHaveBeenCalledWith("q1");
  });

  it("disables continue when required answers are missing", () => {
    setup({ q1: "" });
    const next = pickText(UI.next, "en");
    const btn = screen.getAllByRole("button").find((b) => b.textContent?.includes(next));
    expect(btn).toBeDefined();
    expect(btn).toBeDisabled();
  });

  it("summarizes a pairwise question once with completed comparison progress", () => {
    const survey: Survey = {
      ...SURVEY,
      questions: [
        {
          id: "ahp",
          type: "pairwise_saaty",
          required: true,
          section: { en: "Pairwise", si: "Pairwise", ta: "Pairwise" },
          label: { en: "Compare priorities", si: "Compare priorities", ta: "Compare priorities" },
          criteria: [
            { key: "A", label: { en: "Alpha", si: "Alpha", ta: "Alpha" } },
            { key: "B", label: { en: "Beta", si: "Beta", ta: "Beta" } },
            { key: "C", label: { en: "Gamma", si: "Gamma", ta: "Gamma" } },
          ],
        },
      ],
    };

    render(
      <I18nProvider>
        <ReviewPanel
          survey={survey}
          answers={{
            ahp: {
              A__B: "a5",
              A__C: "b1",
              B__C: "a9",
            },
          }}
          lang="en"
          onEdit={() => {}}
          onContinue={() => {}}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("3/3 comparisons")).toBeInTheDocument();
    expect(screen.getAllByLabelText(pickText(UI.edit, "en"))).toHaveLength(1);
  });
});
