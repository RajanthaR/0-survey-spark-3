import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  selected: [] as Array<{ table: string; columns: string }>,
  filters: [] as Array<{ table: string; column: string; values: string[] }>,
  statsRows: [] as Array<Record<string, unknown>>,
  latestRow: null as Record<string, unknown> | null,
  createAdminClient: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  createAdminClient: mockState.createAdminClient,
}));

function buildMockClient() {
  return {
    from(table: string) {
      if (table === "survey_stats") {
        return {
          select(columns: string) {
            mockState.selected.push({ table, columns });
            return {
              in(column: string, values: string[]) {
                mockState.filters.push({ table, column, values });
                return Promise.resolve({ data: mockState.statsRows, error: null });
              },
            };
          },
        };
      }

      if (table === "responses") {
        return {
          select(columns: string) {
            mockState.selected.push({ table, columns });
            return {
              in(column: string, values: string[]) {
                mockState.filters.push({ table, column, values });
                return {
                  order() {
                    return {
                      limit() {
                        return {
                          maybeSingle() {
                            return Promise.resolve({ data: mockState.latestRow, error: null });
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

import {
  buildResearchAggregates,
  getResearchAggregates,
  maskCount,
} from "@/about/server/research-aggregates.impl.server";

describe("research aggregate masking", () => {
  it("masks public counts below 10", () => {
    expect(maskCount(0)).toEqual({ value: null, label: "<10", masked: true });
    expect(maskCount(9)).toEqual({ value: null, label: "<10", masked: true });
    expect(maskCount(10)).toEqual({ value: 10, label: "10", masked: false });
  });

  it("aggregates completed, started, and in-progress counts without serializing small exact counts", () => {
    const result = buildResearchAggregates(
      [
        {
          survey_slug: "phase-1",
          language: "en",
          n: 12,
          completed: 12,
          in_progress: 0,
        },
        {
          survey_slug: "phase-1",
          language: "si",
          n: 3,
          completed: 0,
          in_progress: 3,
        },
        {
          survey_slug: "phase-3",
          language: "ta",
          n: 8,
          completed: 8,
          in_progress: 0,
        },
        {
          survey_slug: "phase-3",
          language: "en",
          n: 11,
          completed: 0,
          in_progress: 11,
        },
      ],
      { started_at: "2026-05-25T10:30:00.000Z" },
      new Date("2026-05-26T12:45:00.000Z"),
    );

    expect(result.completed.all).toEqual({ value: 20, label: "20", masked: false });
    expect(result.completed.byPhase["phase-1"]).toEqual({
      value: 12,
      label: "12",
      masked: false,
    });
    expect(result.completed.byPhase["phase-3"]).toEqual({
      value: null,
      label: "<10",
      masked: true,
    });
    expect(result.started.byLang.si).toEqual({ value: null, label: "<10", masked: true });
    expect(result.inProgress.byPhase["phase-3"]).toEqual({
      value: 11,
      label: "11",
      masked: false,
    });
    expect(result.lastResponseAgeHours).toBe(26);
    expect(JSON.stringify(result)).not.toMatch(/"8"|"3"/);
  });
});

describe("getResearchAggregates", () => {
  beforeEach(() => {
    mockState.selected = [];
    mockState.filters = [];
    mockState.statsRows = [
      {
        survey_slug: "phase-1",
        language: "en",
        n: 10,
        completed: 10,
        in_progress: 0,
      },
    ];
    mockState.latestRow = { started_at: "2026-05-26T10:00:00.000Z" };
    mockState.createAdminClient.mockReset();
    mockState.createAdminClient.mockReturnValue(buildMockClient());
  });

  it("queries only aggregate-safe columns", async () => {
    await getResearchAggregates(new Date("2026-05-26T11:00:00.000Z"));

    expect(mockState.createAdminClient).toHaveBeenCalledWith("about.researchAggregates");
    expect(mockState.filters).toEqual([
      { table: "survey_stats", column: "survey_slug", values: ["phase-1", "phase-3"] },
      { table: "responses", column: "survey_slug", values: ["phase-1", "phase-3"] },
    ]);
    expect(mockState.selected).toEqual([
      { table: "survey_stats", columns: "survey_slug, language, n, completed, in_progress" },
      { table: "responses", columns: "started_at" },
    ]);

    const selected = mockState.selected.map((call) => call.columns).join(",");
    expect(selected).not.toContain("*");
    for (const sensitive of ["answers", "contact", "resume_token", "user_agent", "id"]) {
      expect(selected).not.toContain(sensitive);
    }
  });
});
