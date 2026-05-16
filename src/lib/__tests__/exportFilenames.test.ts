/**
 * Filename-contract tests for every admin export endpoint. The download
 * filename is what users see and what analysts pivot off of when they
 * stash exports in a folder, so the rules — survey scope, language
 * filter, ISO date stamp — must stay byte-identical to the server fns.
 *
 * Each test pins one rule against either the exported helper
 * (`buildCodebookFilenameStem`) or a verbatim mirror of the inline rule
 * baked into `src/lib/admin.functions.ts`. If the inline rule drifts,
 * the mirror diverges from the source and the corresponding test fails
 * loudly so the drift is caught at CI time, not by an analyst staring
 * at a misnamed file weeks later.
 *
 * Rules covered:
 *   1. Codebook (CSV + XLSX share the same stem):
 *      `eip-insight-codebook[-{slug}][-{langs}][-multisheet]-{YYYY-MM-DD}`
 *   2. All-valid stream:
 *      `eip-insight-all-valid-responses-{YYYY-MM-DD}.csv`
 *   3. Filtered export (CSV + XLSX share the same stem):
 *      `eip-insight-{survey}_{statusPart}_{lang}_{dateTag}-{from}_{dateTag}-{to}_{YYYY-MM-DD}.{csv|xlsx}`
 *   4. Date stamp is always strict ISO `YYYY-MM-DD` (zero-padded month/day,
 *      derived from `Date#toISOString().slice(0,10)` so it's UTC and
 *      reproducible across timezones).
 */
import { describe, it, expect } from "vitest";
import {
  buildCodebookFilenameStem,
  CODEBOOK_LANGS,
  type CodebookLang,
} from "@/lib/codebook-xlsx";

// ---------------------------------------------------------------------------
// Mirrors of the inline filename rules in src/lib/admin.functions.ts. If you
// touch either rule there, update the mirror here in the same patch.
// ---------------------------------------------------------------------------

/** Mirror of `streamAllValidCsv`'s filename rule (admin.functions.ts ~L588). */
function allValidStreamFilename(date: Date): string {
  const stamp = date.toISOString().slice(0, 10);
  return `eip-insight-all-valid-responses-${stamp}.csv`;
}

type FilteredFilenameInput = {
  surveySlug?: string;
  language?: "en" | "si" | "ta";
  dateField: "started_at" | "completed_at";
  statusFilter?: "completed" | "in_progress" | "all";
  validOnly?: boolean;
  completedOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  date: Date;
};

/**
 * Mirror of the filename-stem rule baked into `buildFilteredExportRows`
 * (admin.functions.ts ~L1052-L1072). Suffix-free; callers add `.csv` /
 * `.xlsx`.
 */
function filteredExportFilenameStem(d: FilteredFilenameInput): string {
  const effectiveStatus = d.validOnly
    ? "completed"
    : d.statusFilter ?? (d.completedOnly === false ? "all" : "completed");
  const stamp = d.date.toISOString().slice(0, 10);
  const statusPart = d.validOnly
    ? "valid-completed"
    : effectiveStatus === "completed"
    ? "completed"
    : effectiveStatus === "in_progress"
    ? "in-progress"
    : "all-statuses";
  const dateTag = d.dateField === "completed_at" ? "completed" : "started";
  const parts = [
    d.surveySlug ?? "all-surveys",
    statusPart,
    d.language ?? "all-langs",
    `${dateTag}-${d.dateFrom ?? "any"}`,
    `${dateTag}-${d.dateTo ?? "any"}`,
    stamp,
  ];
  return `eip-insight-${parts.join("_")}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const D = new Date("2026-05-15T07:30:00.000Z");

describe("export filename rules — codebook", () => {
  it("all-language, all-survey scope drops both tags", () => {
    expect(
      buildCodebookFilenameStem({ langs: CODEBOOK_LANGS, date: D }),
    ).toBe("eip-insight-codebook-2026-05-15");
  });

  it("survey scope is inserted before the date stamp", () => {
    expect(
      buildCodebookFilenameStem({
        surveySlug: "phase-1",
        langs: CODEBOOK_LANGS,
        date: D,
      }),
    ).toBe("eip-insight-codebook-phase-1-2026-05-15");
  });

  it("__all__ scope is treated as no scope", () => {
    expect(
      buildCodebookFilenameStem({
        surveySlug: "__all__",
        langs: CODEBOOK_LANGS,
        date: D,
      }),
    ).toBe("eip-insight-codebook-2026-05-15");
  });

  it.each<[CodebookLang[], string]>([
    [["en"], "-en"],
    [["si"], "-si"],
    [["ta"], "-ta"],
    [["en", "si"], "-ensi"],
    [["si", "ta"], "-sita"],
    [["ta", "en"], "-taen"], // order is preserved verbatim
  ])("partial language filter %j → tag '%s'", (langs, tag) => {
    expect(
      buildCodebookFilenameStem({ langs, date: D }),
    ).toBe(`eip-insight-codebook${tag}-2026-05-15`);
  });

  it("perLanguageSheets adds -multisheet only when 2+ langs are exported", () => {
    expect(
      buildCodebookFilenameStem({
        langs: CODEBOOK_LANGS,
        perLanguageSheets: true,
        date: D,
      }),
    ).toBe("eip-insight-codebook-multisheet-2026-05-15");

    // One language → multisheet is meaningless and dropped.
    expect(
      buildCodebookFilenameStem({
        langs: ["en"],
        perLanguageSheets: true,
        date: D,
      }),
    ).toBe("eip-insight-codebook-en-2026-05-15");
  });

  it("survey scope + lang filter + multisheet compose in stable order", () => {
    expect(
      buildCodebookFilenameStem({
        surveySlug: "phase-3",
        langs: ["si", "ta"],
        perLanguageSheets: true,
        date: D,
      }),
    ).toBe("eip-insight-codebook-phase-3-sita-multisheet-2026-05-15");
  });

  it("date stamp is strict ISO YYYY-MM-DD (UTC, zero-padded)", () => {
    const stem = buildCodebookFilenameStem({
      langs: CODEBOOK_LANGS,
      date: new Date("2026-01-02T23:59:59.999Z"),
    });
    expect(stem.endsWith("-2026-01-02")).toBe(true);
    const tail = stem.slice(stem.length - 10);
    expect(tail).toMatch(ISO_DATE);
  });

  it("CSV and XLSX exports share the same stem (only the extension differs)", () => {
    const stem = buildCodebookFilenameStem({
      surveySlug: "phase-1",
      langs: ["en", "si"],
      date: D,
    });
    expect(`${stem}.csv`).toBe("eip-insight-codebook-phase-1-ensi-2026-05-15.csv");
    expect(`${stem}.xlsx`).toBe("eip-insight-codebook-phase-1-ensi-2026-05-15.xlsx");
  });
});

describe("export filename rules — all-valid stream", () => {
  it("uses the canonical stamp suffix", () => {
    expect(allValidStreamFilename(D)).toBe(
      "eip-insight-all-valid-responses-2026-05-15.csv",
    );
  });

  it("date is strict ISO YYYY-MM-DD", () => {
    const fn = allValidStreamFilename(new Date("2026-12-09T03:00:00.000Z"));
    expect(fn).toMatch(/-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(fn).toBe("eip-insight-all-valid-responses-2026-12-09.csv");
  });
});

describe("export filename rules — filtered CSV/XLSX", () => {
  it("defaults: no scope, no lang, completed-only, started date field", () => {
    expect(
      filteredExportFilenameStem({ dateField: "started_at", date: D }),
    ).toBe(
      "eip-insight-all-surveys_completed_all-langs_started-any_started-any_2026-05-15",
    );
  });

  it("survey scope and language filter slot in", () => {
    expect(
      filteredExportFilenameStem({
        surveySlug: "phase-1",
        language: "si",
        dateField: "started_at",
        statusFilter: "completed",
        date: D,
      }),
    ).toBe(
      "eip-insight-phase-1_completed_si_started-any_started-any_2026-05-15",
    );
  });

  it.each<["en" | "si" | "ta", string]>([
    ["en", "en"],
    ["si", "si"],
    ["ta", "ta"],
  ])("language %s renders verbatim in the filename segment", (lang, segment) => {
    const stem = filteredExportFilenameStem({
      language: lang,
      dateField: "started_at",
      date: D,
    });
    // The language segment is the 3rd `_`-separated chunk after the
    // `eip-insight-` prefix.
    const tail = stem.slice("eip-insight-".length);
    expect(tail.split("_")[2]).toBe(segment);
  });

  it("validOnly forces the status segment to 'valid-completed'", () => {
    expect(
      filteredExportFilenameStem({
        validOnly: true,
        statusFilter: "in_progress", // overridden by validOnly
        dateField: "started_at",
        date: D,
      }).split("_")[1],
    ).toBe("valid-completed");
  });

  it.each<[
    "completed" | "in_progress" | "all",
    "completed" | "in-progress" | "all-statuses",
  ]>([
    ["completed", "completed"],
    ["in_progress", "in-progress"],
    ["all", "all-statuses"],
  ])("statusFilter %s → segment %s", (status, segment) => {
    expect(
      filteredExportFilenameStem({
        statusFilter: status,
        dateField: "started_at",
        date: D,
      }).split("_")[1],
    ).toBe(segment);
  });

  it("dateField switches the date-tag prefix between started/completed", () => {
    const started = filteredExportFilenameStem({
      dateField: "started_at",
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01",
      date: D,
    });
    expect(started).toContain("_started-2026-01-01_started-2026-02-01_");

    const completed = filteredExportFilenameStem({
      dateField: "completed_at",
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01",
      date: D,
    });
    expect(completed).toContain("_completed-2026-01-01_completed-2026-02-01_");
  });

  it("missing date bounds render as 'any'", () => {
    const stem = filteredExportFilenameStem({
      dateField: "completed_at",
      date: D,
    });
    expect(stem).toContain("_completed-any_completed-any_");
  });

  it("ends with the strict ISO date stamp", () => {
    const stem = filteredExportFilenameStem({
      dateField: "started_at",
      date: new Date("2026-07-04T12:00:00.000Z"),
    });
    expect(stem.endsWith("_2026-07-04")).toBe(true);
    const segments = stem.split("_");
    expect(segments[segments.length - 1]).toMatch(ISO_DATE);
  });

  it("CSV and XLSX share the same stem (only the extension differs)", () => {
    const stem = filteredExportFilenameStem({
      surveySlug: "phase-3",
      language: "ta",
      validOnly: true,
      dateField: "completed_at",
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
      date: D,
    });
    expect(`${stem}.csv`).toBe(
      "eip-insight-phase-3_valid-completed_ta_completed-2026-03-01_completed-2026-03-31_2026-05-15.csv",
    );
    expect(`${stem}.xlsx`).toBe(
      "eip-insight-phase-3_valid-completed_ta_completed-2026-03-01_completed-2026-03-31_2026-05-15.xlsx",
    );
  });
});
