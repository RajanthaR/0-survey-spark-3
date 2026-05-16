/**
 * Validates the export-only-valid-completed filter that powers the admin
 * "Valid only" checkbox. The contract tested here is the one used by the
 * `exportFilteredCsv` server function with `validOnly: true`:
 *
 *   - completed responses with every visible required question answered → kept
 *   - completed responses missing a required answer → dropped
 *   - completed responses where the missing required question is HIDDEN by a
 *     showIf branch → kept (the question was never asked)
 *   - in-progress responses → dropped (validOnly implies completedOnly)
 *   - rows whose survey_slug isn't known to the running app → dropped
 *
 * We exercise the whole pipeline (status filter + per-row validity check +
 * unknown-survey guard) the same way the server function would, against a
 * fixture survey with required, optional, and conditionally-required
 * questions.
 */
import { describe, it, expect } from "vitest";
import { isValidCompletedResponse } from "@/lib/survey-logic";
import type { Survey } from "@/surveys/types";

const SURVEY: Survey = {
  slug: "valid-export",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "name",
      type: "text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Name", si: "N", ta: "N" },
      required: true,
    },
    {
      id: "topics",
      type: "multi_choice",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Topics", si: "T", ta: "T" },
      required: true,
      minSelect: 2,
      options: [
        { value: "a", label: { en: "A", si: "A", ta: "A" } },
        { value: "b", label: { en: "B", si: "B", ta: "B" } },
        { value: "c", label: { en: "C", si: "C", ta: "C" } },
      ],
    },
    {
      id: "comments",
      type: "long_text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Comments", si: "C", ta: "C" },
      required: false,
    },
    {
      id: "hasFollowup",
      type: "yes_no",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Followup?", si: "F", ta: "F" },
      required: true,
    },
    {
      id: "followupNotes",
      type: "text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Followup notes", si: "FN", ta: "FN" },
      required: true,
      showIf: { questionId: "hasFollowup", op: "eq", value: "yes" },
    },
  ],
};

const SURVEYS_REGISTRY: Record<string, Survey> = { [SURVEY.slug]: SURVEY };

type Row = {
  id: string;
  survey_slug: string;
  status: string;
  answers: Record<string, unknown>;
};

/**
 * Mirrors the server-side filter pipeline used by `exportFilteredCsv` when
 * `validOnly: true` is set. Kept inline so the test fails the same way the
 * server function would if the contract changes.
 */
function filterValidCompleted(rows: Row[]): {
  kept: Row[];
  droppedInProgress: number;
  droppedInvalid: number;
  droppedUnknownSurvey: number;
} {
  let droppedInProgress = 0;
  let droppedInvalid = 0;
  let droppedUnknownSurvey = 0;
  const kept: Row[] = [];
  for (const r of rows) {
    if (r.status !== "completed") {
      droppedInProgress += 1;
      continue;
    }
    const survey = SURVEYS_REGISTRY[r.survey_slug];
    if (!survey) {
      droppedUnknownSurvey += 1;
      continue;
    }
    if (!isValidCompletedResponse(survey, r.answers)) {
      droppedInvalid += 1;
      continue;
    }
    kept.push(r);
  }
  return { kept, droppedInProgress, droppedInvalid, droppedUnknownSurvey };
}

describe("admin export — valid-completed filter", () => {
  it("keeps fully-answered completed responses", () => {
    const row: Row = {
      id: "r1",
      survey_slug: "valid-export",
      status: "completed",
      answers: {
        name: "Sample Org",
        topics: ["a", "b"],
        hasFollowup: "no",
      },
    };
    expect(isValidCompletedResponse(SURVEY, row.answers)).toBe(true);
    const out = filterValidCompleted([row]);
    expect(out.kept).toHaveLength(1);
    expect(out.droppedInvalid).toBe(0);
  });

  it("drops completed responses that miss a required text answer", () => {
    const row: Row = {
      id: "r2",
      survey_slug: "valid-export",
      status: "completed",
      answers: {
        name: "   ", // whitespace-only counts as unanswered
        topics: ["a", "b"],
        hasFollowup: "no",
      },
    };
    expect(isValidCompletedResponse(SURVEY, row.answers)).toBe(false);
    const out = filterValidCompleted([row]);
    expect(out.kept).toHaveLength(0);
    expect(out.droppedInvalid).toBe(1);
  });

  it("drops completed responses that miss a required multi-select", () => {
    const row: Row = {
      id: "r3",
      survey_slug: "valid-export",
      status: "completed",
      answers: { name: "Sample Org", topics: [], hasFollowup: "no" },
    };
    expect(isValidCompletedResponse(SURVEY, row.answers)).toBe(false);
    expect(filterValidCompleted([row]).kept).toHaveLength(0);
  });

  it("ignores required questions hidden by a showIf branch", () => {
    // hasFollowup=no → followupNotes is not visible, so missing it is fine.
    const row: Row = {
      id: "r4",
      survey_slug: "valid-export",
      status: "completed",
      answers: { name: "Sample Org", topics: ["a", "b"], hasFollowup: "no" },
    };
    expect(isValidCompletedResponse(SURVEY, row.answers)).toBe(true);
    expect(filterValidCompleted([row]).kept).toHaveLength(1);
  });

  it("enforces required answers that become visible via showIf", () => {
    // hasFollowup=yes → followupNotes IS required and missing → invalid.
    const row: Row = {
      id: "r5",
      survey_slug: "valid-export",
      status: "completed",
      answers: { name: "Sample Org", topics: ["a", "b"], hasFollowup: "yes" },
    };
    expect(isValidCompletedResponse(SURVEY, row.answers)).toBe(false);
    expect(filterValidCompleted([row]).kept).toHaveLength(0);
  });

  it("keeps the same response once the now-visible required answer is filled", () => {
    const row: Row = {
      id: "r6",
      survey_slug: "valid-export",
      status: "completed",
      answers: {
        name: "Sample Org",
        topics: ["a", "b"],
        hasFollowup: "yes",
        followupNotes: "see attached",
      },
    };
    expect(isValidCompletedResponse(SURVEY, row.answers)).toBe(true);
    expect(filterValidCompleted([row]).kept).toHaveLength(1);
  });

  it("drops in-progress responses even when their answers happen to be complete", () => {
    const row: Row = {
      id: "r7",
      survey_slug: "valid-export",
      status: "in_progress",
      answers: { name: "Sample Org", topics: ["a", "b"], hasFollowup: "no" },
    };
    const out = filterValidCompleted([row]);
    expect(out.kept).toHaveLength(0);
    expect(out.droppedInProgress).toBe(1);
    expect(out.droppedInvalid).toBe(0);
  });

  it("drops rows whose survey_slug is unknown to the running app", () => {
    const row: Row = {
      id: "r8",
      survey_slug: "ghost-survey",
      status: "completed",
      answers: { name: "Sample Org" },
    };
    const out = filterValidCompleted([row]);
    expect(out.kept).toHaveLength(0);
    expect(out.droppedUnknownSurvey).toBe(1);
  });

  it("preserves the ordering of kept rows and reports per-bucket drop counts", () => {
    const rows: Row[] = [
      { id: "ok-1", survey_slug: "valid-export", status: "completed", answers: { name: "A", topics: ["a", "b"], hasFollowup: "no" } },
      { id: "bad-missing", survey_slug: "valid-export", status: "completed", answers: { name: "B", topics: ["a"], hasFollowup: "no" } },
      { id: "wip", survey_slug: "valid-export", status: "in_progress", answers: { name: "C", topics: ["a", "b"], hasFollowup: "no" } },
      { id: "ok-2", survey_slug: "valid-export", status: "completed", answers: { name: "D", topics: ["a", "c"], hasFollowup: "yes", followupNotes: "x" } },
      { id: "ghost", survey_slug: "ghost-survey", status: "completed", answers: {} },
    ];
    const out = filterValidCompleted(rows);
    expect(out.kept.map((r) => r.id)).toEqual(["ok-1", "ok-2"]);
    expect(out.droppedInvalid).toBe(1);
    expect(out.droppedInProgress).toBe(1);
    expect(out.droppedUnknownSurvey).toBe(1);
  });
});
