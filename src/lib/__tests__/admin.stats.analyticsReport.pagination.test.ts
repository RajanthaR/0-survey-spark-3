import { describe, expect, it } from "vitest";

import {
  buildAnalyticsReport,
  fetchPaginatedAnalyticsReportRows,
  type AnalyticsReportInput,
  type AnalyticsReportRow,
} from "@/lib/admin.stats.functions";
import { SURVEYS } from "@/surveys";

const SURVEY_SLUG = "phase-1" as const;
const firstQuestionId = (() => {
  const question = SURVEYS[SURVEY_SLUG].questions.find((q) => q.type !== "section_header");
  if (!question) throw new Error("Expected phase-1 to have a reportable question");
  return question.id;
})();

function makeRows(
  count: number,
  startIndex: number,
  overrides: Partial<AnalyticsReportRow>,
): AnalyticsReportRow[] {
  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset;
    return {
      id: `response-${index}`,
      survey_slug: SURVEY_SLUG,
      language: "en",
      status: "completed",
      started_at: `2026-05-${String((index % 28) + 1).padStart(2, "0")}T00:00:00Z`,
      completed_at: null,
      answers: { [firstQuestionId]: "answered" },
      ...overrides,
    };
  });
}

describe("analytics report pagination", () => {
  it("fetches and reports rows beyond the previous 5,000-row cap", async () => {
    const pages = [
      makeRows(1000, 0, { language: "en", status: "completed" }),
      makeRows(1000, 1000, { language: "en", status: "completed" }),
      makeRows(1000, 2000, { language: "si", status: "completed" }),
      makeRows(1000, 3000, { language: "ta", status: "in_progress" }),
      makeRows(1000, 4000, { language: "si", status: "in_progress" }),
      makeRows(5, 5000, { language: "si", status: "completed" }),
    ];
    const calls: Array<[number, number]> = [];

    const rows = await fetchPaginatedAnalyticsReportRows(async (from, to) => {
      calls.push([from, to]);
      return pages[from / 1000] ?? [];
    });

    const input: AnalyticsReportInput = {
      surveySlug: SURVEY_SLUG,
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
    };
    const report = buildAnalyticsReport(input, rows, "2026-05-24T00:00:00.000Z");

    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [3000, 3999],
      [4000, 4999],
      [5000, 5999],
    ]);
    expect(report.total).toBe(5005);
    expect(report.completed).toBe(3005);
    expect(report.inProgress).toBe(2000);
    expect(report.completionRate).toBe(60);
    expect(report.byLanguage).toEqual([
      { language: "si", count: 2005, pct: 40 },
      { language: "en", count: 2000, pct: 40 },
      { language: "ta", count: 1000, pct: 20 },
    ]);
    expect(report.dropOff.find((q) => q.id === firstQuestionId)).toMatchObject({
      answered: 5005,
      total: 5005,
      answeredPct: 100,
      dropOffPct: 0,
    });
  });
});
