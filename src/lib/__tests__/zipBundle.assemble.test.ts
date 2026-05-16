/**
 * Pins the ZIP bundle export contract used by `exportZipBundle` (admin
 * "Bundle (ZIP)" button). The server fn delegates assembly to
 * `assembleZipBundle`, which we exercise here against fixture rows so we
 * can assert structure without booting Supabase or the auth middleware.
 *
 * Verifies:
 *   1. The file list contains exactly one `<slug>.csv` per requested
 *      survey, with `summary.csv` first and `codebook.csv` last.
 *   2. Per-survey CSV row counts equal the rows passed in for that slug,
 *      after `validOnly` row-level filtering.
 *   3. `summary.csv` totals (per-survey + grand total) match the
 *      per-survey CSVs.
 *   4. Bundle filename is stable for a given filter set and date, mirrors
 *      `exportFilteredCsv` naming, and changes when the filters change.
 *   5. `codebook.csv` is included unconditionally.
 *   6. When `surveySlug` narrows the bundle, only that survey's CSV ships.
 */
import { describe, it, expect } from "vitest";

import { assembleZipBundle } from "@/lib/admin.functions";
import { SURVEYS } from "@/surveys";

const FIXED_NOW = new Date("2026-05-15T12:00:00.000Z");

const SLUG_A = "phase-1";
const SLUG_B = "phase-3";

function row(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? `r-${Math.random().toString(36).slice(2, 8)}`,
    survey_slug: slug,
    language: "en",
    status: "completed",
    progress_pct: 100,
    started_at: "2026-05-10T10:00:00.000Z",
    completed_at: "2026-05-10T10:05:00.000Z",
    contact: { name: "X", email: "x@y.z", organization: "" },
    answers: {},
    ...overrides,
  };
}

const BASE_FILTERS = {
  dateField: "started_at" as const,
  completedOnly: true,
  validOnly: false,
};

/** Read the data rows of a CSV (drop BOM, header, and any leading `#` comment lines). */
function dataRowCount(csv: string): number {
  const lines = csv.replace(/^\uFEFF/, "").split("\n");
  // Drop comment + header lines: every leading line that starts with `#` plus
  // exactly one header row.
  let i = 0;
  while (i < lines.length && lines[i].startsWith("#")) i += 1;
  // header row
  i += 1;
  return Math.max(0, lines.length - i);
}

describe("assembleZipBundle — file list, row counts, filename", () => {
  it("emits summary.csv first, codebook.csv last, and one CSV per survey in between", () => {
    const out = assembleZipBundle({
      data: { ...BASE_FILTERS },
      rowsBySlug: {
        [SLUG_A]: [row(SLUG_A), row(SLUG_A)],
        [SLUG_B]: [row(SLUG_B)],
      },
      now: FIXED_NOW,
    });

    expect(out.files.map((f) => f.name)).toEqual([
      "summary.csv",
      `${SLUG_A}.csv`,
      `${SLUG_B}.csv`,
      "codebook.csv",
    ]);
    expect(out.surveyCount).toBe(2);
    expect(out.totalRows).toBe(3);
  });

  it("per-survey CSV row count equals the rows passed in for that slug", () => {
    const out = assembleZipBundle({
      data: { ...BASE_FILTERS },
      rowsBySlug: {
        [SLUG_A]: [row(SLUG_A), row(SLUG_A), row(SLUG_A)],
        [SLUG_B]: [row(SLUG_B), row(SLUG_B)],
      },
      now: FIXED_NOW,
    });

    const csvA = out.files.find((f) => f.name === `${SLUG_A}.csv`)!.csv;
    const csvB = out.files.find((f) => f.name === `${SLUG_B}.csv`)!.csv;
    expect(dataRowCount(csvA)).toBe(3);
    expect(dataRowCount(csvB)).toBe(2);
  });

  it("summary.csv per-survey totals line up with the per-survey CSVs", () => {
    const out = assembleZipBundle({
      data: { ...BASE_FILTERS },
      rowsBySlug: {
        [SLUG_A]: [row(SLUG_A), row(SLUG_A, { language: "si" })],
        [SLUG_B]: [row(SLUG_B), row(SLUG_B), row(SLUG_B, { language: "ta" })],
      },
      now: FIXED_NOW,
    });
    const summary = out.files.find((f) => f.name === "summary.csv")!.csv;
    const lines = summary.replace(/^\uFEFF/, "").split("\n");
    // Layout: # filters: …, header, then one row per survey.
    expect(lines[0]).toMatch(/^# filters: /);
    const headerCols = lines[1].split(",");
    expect(headerCols[0]).toBe("survey_slug");
    expect(headerCols[2]).toBe("total_responses");
    const bodyBySlug = new Map(
      lines.slice(2).map((l) => {
        const cols = l.split(",");
        return [cols[0], cols] as const;
      }),
    );
    expect(bodyBySlug.get(SLUG_A)?.[2]).toBe("2");
    expect(bodyBySlug.get(SLUG_B)?.[2]).toBe("3");
    // Grand total in the bundle return matches the sum.
    expect(out.totalRows).toBe(5);
  });

  it("validOnly drops rows that fail required-answer validity", () => {
    // phase-1 has multiple required questions, so a row with empty
    // answers is guaranteed to fail isValidCompletedResponse and be
    // dropped from both the per-survey CSV and totalRows.
    const out = assembleZipBundle({
      data: { ...BASE_FILTERS, validOnly: true },
      rowsBySlug: {
        [SLUG_A]: [
          row(SLUG_A, { answers: {} }),
          row(SLUG_A, { answers: {} }),
          row(SLUG_A, { answers: {} }),
        ],
      },
      now: FIXED_NOW,
    });
    const csvA = out.files.find((f) => f.name === `${SLUG_A}.csv`)!.csv;
    expect(dataRowCount(csvA)).toBe(0);
    expect(out.totalRows).toBe(0);

    // Sanity: with validOnly OFF, the same rows survive — proves the
    // drop above came from the validity filter, not from row shape.
    const passthrough = assembleZipBundle({
      data: { ...BASE_FILTERS, validOnly: false },
      rowsBySlug: {
        [SLUG_A]: [
          row(SLUG_A, { answers: {} }),
          row(SLUG_A, { answers: {} }),
          row(SLUG_A, { answers: {} }),
        ],
      },
      now: FIXED_NOW,
    });
    const csvAPass = passthrough.files.find((f) => f.name === `${SLUG_A}.csv`)!.csv;
    expect(dataRowCount(csvAPass)).toBe(3);
    expect(passthrough.totalRows).toBe(3);
  });

  it("filename is stable for a given filter set + date and mirrors exportFilteredCsv naming", () => {
    const out = assembleZipBundle({
      data: { ...BASE_FILTERS, surveySlug: SLUG_A, language: "en" },
      rowsBySlug: { [SLUG_A]: [row(SLUG_A)] },
      now: FIXED_NOW,
    });
    expect(out.filename).toBe(
      `eip-insight-bundle_${SLUG_A}_completed_en_started-any_started-any_2026-05-15.zip`,
    );
  });

  it("filename changes when filters change", () => {
    const a = assembleZipBundle({
      data: { ...BASE_FILTERS },
      rowsBySlug: { [SLUG_A]: [], [SLUG_B]: [] },
      now: FIXED_NOW,
    });
    const b = assembleZipBundle({
      data: {
        ...BASE_FILTERS,
        validOnly: true,
        language: "ta",
        dateFrom: "2026-01-01",
        dateTo: "2026-04-30",
        dateField: "completed_at",
      },
      rowsBySlug: { [SLUG_A]: [], [SLUG_B]: [] },
      now: FIXED_NOW,
    });
    expect(a.filename).not.toBe(b.filename);
    expect(b.filename).toBe(
      `eip-insight-bundle_all-surveys_valid-completed_ta_completed-2026-01-01_completed-2026-04-30_2026-05-15.zip`,
    );
  });

  it("codebook.csv is included even when there are zero rows", () => {
    const out = assembleZipBundle({
      data: { ...BASE_FILTERS },
      rowsBySlug: { [SLUG_A]: [], [SLUG_B]: [] },
      now: FIXED_NOW,
    });
    const cb = out.files.find((f) => f.name === "codebook.csv");
    expect(cb).toBeDefined();
    // Codebook always has a header line, even if SURVEYS becomes empty
    // someday.
    expect(cb!.csv.replace(/^\uFEFF/, "").split("\n")[0]).toMatch(/.+/);
    expect(out.totalRows).toBe(0);
  });

  it("surveySlug narrowing ships exactly one per-survey CSV", () => {
    const out = assembleZipBundle({
      data: { ...BASE_FILTERS, surveySlug: SLUG_B },
      rowsBySlug: { [SLUG_B]: [row(SLUG_B), row(SLUG_B)] },
      now: FIXED_NOW,
    });
    const perSurvey = out.files.filter(
      (f) => f.name !== "summary.csv" && f.name !== "codebook.csv",
    );
    expect(perSurvey.map((f) => f.name)).toEqual([`${SLUG_B}.csv`]);
    expect(out.surveyCount).toBe(1);
    expect(out.totalRows).toBe(2);
  });
});
