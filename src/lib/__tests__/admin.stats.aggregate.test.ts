import { describe, expect, it } from "vitest";

import { aggregateStatsViewRows, type SurveyStatsViewRow } from "@/lib/admin.stats.functions";

function row(overrides: Partial<SurveyStatsViewRow>): SurveyStatsViewRow {
  return {
    survey_slug: "phase-1",
    language: "en",
    status: "completed",
    day: "2026-05-18",
    n: 0,
    completed: 0,
    in_progress: 0,
    duration_ms_sum: 0,
    duration_count: 0,
    ...overrides,
  };
}

describe("aggregateStatsViewRows", () => {
  it("aggregates a 5,000-response fixture without a row cap", () => {
    const summary = aggregateStatsViewRows(
      [
        row({
          day: "2026-05-18",
          n: 3000,
          completed: 2000,
          duration_ms_sum: 2000 * 10 * 60 * 1000,
          duration_count: 2000,
        }),
        row({
          day: "2026-05-19",
          language: "si",
          status: "in_progress",
          n: 2000,
          in_progress: 2000,
        }),
      ],
      new Date("2026-05-20T12:00:00Z"),
    );

    expect(summary.total).toBe(5000);
    expect(summary.completed).toBe(2000);
    expect(summary.inProgress).toBe(2000);
    expect(summary.completionRate).toBe(40);
    expect(summary.avgMinutes).toBe(10);
    expect(summary.langSplit).toEqual([
      { name: "en", value: 3000 },
      { name: "si", value: 2000 },
    ]);
    expect(summary.daily.slice(-3)).toEqual([
      { date: "2026-05-18", count: 3000 },
      { date: "2026-05-19", count: 2000 },
      { date: "2026-05-20", count: 0 },
    ]);
  });
});
