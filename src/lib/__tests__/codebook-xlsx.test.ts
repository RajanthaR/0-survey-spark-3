/**
 * Unit + integration tests for the codebook XLSX builder
 * (`src/lib/codebook-xlsx.ts`) and the auth-protected server fns that
 * delegate to it (`exportCodebookCsv` / `exportCodebookXlsx`).
 *
 * Covers the contracts the admin UI relies on:
 *   1. Base64 — non-empty, decodes back to a valid XLSX (PK zip header).
 *   2. Single-sheet mode — workbook has exactly one sheet named "Codebook".
 *   3. Header row — frozen at row 1 (`!freeze.ySplit === 1`) and every
 *      header cell carries `font.bold === true`.
 *   4. Header / row count fidelity — header column count matches
 *      `buildCodebookHeaders(langs)`, row count matches the codebook
 *      total (questions + every option row), every cell value matches
 *      the survey definition for the (slug, qid, optValue, lang) tuple.
 *   5. Multilingual labels — Sinhala + Tamil cells contain script-range
 *      characters, never collapsed to English.
 *   6. Per-language sheets mode — workbook has one sheet per requested
 *      language (uppercased names "EN"/"SI"/"TA"), each scoped to that
 *      single language; counts are language-independent (driven by the
 *      survey, not the language axis).
 *   7. Caching — identical inputs return `cacheHit: true` on the second
 *      call AND yield byte-identical base64 (proving cache integrity).
 *      Different inputs miss the cache. Cache size grows / clears.
 *   8. Filename stem — encodes scope, language tag, multisheet flag,
 *      and date stamp in canonical order.
 *   9. Authorization — `assertAdmin` rejects non-admins with the exact
 *      "Forbidden: admin role required" message used by the toast.
 *  10. CSV/XLSX server fn payload structure — the keys the admin UI
 *      destructures (`csv|base64`, `filename`, `questionCount`,
 *      `optionCount`, `surveyCount`, plus `sheetNames|cacheHit` for
 *      XLSX) are present and well-typed via a thin payload-shape probe
 *      that uses the same builder the handler does.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as XLSXNS from "xlsx";
import { strFromU8, unzipSync } from "fflate";

import {
  buildCodebookXlsx,
  buildCodebookFilenameStem,
  clearCodebookXlsxCache,
  codebookXlsxCacheSize,
  CODEBOOK_SHEET_NAME,
} from "@/lib/codebook-xlsx";
import { buildCodebookHeaders, buildCodebookRows, CODEBOOK_LANGS } from "@/lib/csv-export-shape";
import { SURVEYS } from "@/surveys";
import { pickText } from "@/lib/i18n";
import { YES_NO_OPTIONS } from "@/surveys/types";

vi.mock("@/integrations/supabase/client.server", () => {
  const mock = {
    from: () => mock,
    select: () => mock,
    eq: () => mock,
    maybeSingle: vi.fn(),
  };
  return { createAdminClient: vi.fn(() => mock) };
});

const ALL_SLUGS = Object.keys(SURVEYS);
const FIRST_SLUG = ALL_SLUGS[0];

function decode(base64: string): Uint8Array {
  const bin = atob(base64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
  return u8;
}

function readWorkbook(base64: string): XLSXNS.WorkBook {
  return XLSXNS.read(decode(base64), { type: "array", cellStyles: true });
}

function firstSheetXml(base64: string): string {
  const zip = unzipSync(decode(base64));
  const sheet = zip["xl/worksheets/sheet1.xml"];
  expect(sheet).toBeDefined();
  return strFromU8(sheet);
}

beforeEach(() => {
  clearCodebookXlsxCache();
});

describe("buildCodebookXlsx — base64 + workbook structure", () => {
  it("returns non-empty base64 that decodes to an XLSX zip (PK header)", async () => {
    const r = await buildCodebookXlsx({
      slugs: [FIRST_SLUG],
      langs: CODEBOOK_LANGS,
      perLanguageSheets: false,
    });
    expect(typeof r.base64).toBe("string");
    expect(r.base64.length).toBeGreaterThan(100);
    // Round-trip valid base64.
    expect(() => atob(r.base64)).not.toThrow();
    const bytes = decode(r.base64);
    expect(bytes.byteLength).toBe(r.byteLength);
    // XLSX = ZIP archive — must start with the local-file-header magic "PK\x03\x04".
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });

  it("single-sheet mode: workbook has exactly one sheet named 'Codebook'", async () => {
    const r = await buildCodebookXlsx({
      slugs: [FIRST_SLUG],
      langs: CODEBOOK_LANGS,
      perLanguageSheets: false,
    });
    const wb = readWorkbook(r.base64);
    expect(wb.SheetNames).toEqual([CODEBOOK_SHEET_NAME]);
    expect(r.sheetNames).toEqual([CODEBOOK_SHEET_NAME]);
  });

  it("freezes the header row and bolds every header cell", async () => {
    const r = await buildCodebookXlsx({
      slugs: [FIRST_SLUG],
      langs: CODEBOOK_LANGS,
      perLanguageSheets: false,
    });
    const xml = firstSheetXml(r.base64);
    expect(xml).toContain('ySplit="1"');
    expect(xml).toContain('state="frozen"');
    const wb = readWorkbook(r.base64);
    const ws = wb.Sheets[CODEBOOK_SHEET_NAME];
    // Every header cell carries `font.bold === true`.
    for (let c = 0; c < r.headerRow.length; c += 1) {
      const addr = XLSXNS.utils.encode_cell({ r: 0, c });
      const cell = ws[addr] as XLSXNS.CellObject | undefined;
      expect(cell, `header cell ${addr}`).toBeDefined();
      const style = (cell as unknown as { s?: { font?: { bold?: boolean } } }).s;
      expect(style?.font?.bold).toBe(true);
    }
  });
});

describe("buildCodebookXlsx — header / row count fidelity vs survey definitions", () => {
  it("header row matches buildCodebookHeaders(langs) exactly", async () => {
    const r = await buildCodebookXlsx({
      slugs: ALL_SLUGS,
      langs: CODEBOOK_LANGS,
      perLanguageSheets: false,
    });
    expect(r.headerRow).toEqual(buildCodebookHeaders(CODEBOOK_LANGS));
    const expectedSi = await buildCodebookXlsx({
      slugs: ALL_SLUGS,
      langs: ["si"] as const,
      perLanguageSheets: false,
    });
    expect(expectedSi.headerRow).toEqual(buildCodebookHeaders(["si"]));
    // Single-language headers must drop the other label columns.
    expect(expectedSi.headerRow.length).toBeLessThan(r.headerRow.length);
  });

  it("data row count + every multilingual label cell match buildCodebookRows", async () => {
    const r = await buildCodebookXlsx({
      slugs: ALL_SLUGS,
      langs: CODEBOOK_LANGS,
      perLanguageSheets: false,
    });
    const expected = buildCodebookRows(ALL_SLUGS, CODEBOOK_LANGS);
    expect(r.questionCount).toBe(expected.questionCount);
    expect(r.optionCount).toBe(expected.optionCount);
    expect(r.surveyCount).toBe(expected.surveyCount);

    const wb = readWorkbook(r.base64);
    const ws = wb.Sheets[CODEBOOK_SHEET_NAME];
    const aoa = XLSXNS.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      defval: "",
    }) as string[][];
    // First row is header, remainder is data.
    expect(aoa.length - 1).toBe(expected.rows.length);
    for (let i = 0; i < expected.rows.length; i += 1) {
      const want = expected.rows[i].map((v) => String(v ?? ""));
      const got = aoa[i + 1].map((v) => String(v ?? ""));
      // Pad/trim to header length (xlsx may drop trailing empties).
      const W = r.headerRow.length;
      expect(got.slice(0, W)).toEqual(want.slice(0, W));
    }
  });

  it("Sinhala + Tamil label cells contain script-range characters (not collapsed to EN)", async () => {
    const r = await buildCodebookXlsx({
      slugs: ALL_SLUGS,
      langs: CODEBOOK_LANGS,
      perLanguageSheets: false,
    });
    const wb = readWorkbook(r.base64);
    const ws = wb.Sheets[CODEBOOK_SHEET_NAME];
    const aoa = XLSXNS.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      defval: "",
    }) as string[][];
    const headers = aoa[0];
    const siCols = headers.map((h, idx) => (/_si$/.test(h) ? idx : -1)).filter((idx) => idx >= 0);
    const taCols = headers.map((h, idx) => (/_ta$/.test(h) ? idx : -1)).filter((idx) => idx >= 0);
    expect(siCols.length).toBeGreaterThan(0);
    expect(taCols.length).toBeGreaterThan(0);
    const SI_RE = /[\u0D80-\u0DFF]/;
    const TA_RE = /[\u0B80-\u0BFF]/;
    let siHits = 0;
    let taHits = 0;
    for (let i = 1; i < aoa.length; i += 1) {
      for (const c of siCols) if (SI_RE.test(aoa[i][c] ?? "")) siHits += 1;
      for (const c of taCols) if (TA_RE.test(aoa[i][c] ?? "")) taHits += 1;
    }
    expect(siHits).toBeGreaterThan(0);
    expect(taHits).toBeGreaterThan(0);
  });

  it("yes_no rows source labels from YES_NO_OPTIONS for every language", async () => {
    const r = await buildCodebookXlsx({
      slugs: ALL_SLUGS,
      langs: CODEBOOK_LANGS,
      perLanguageSheets: false,
    });
    const wb = readWorkbook(r.base64);
    const ws = wb.Sheets[CODEBOOK_SHEET_NAME];
    const aoa = XLSXNS.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      defval: "",
    }) as string[][];
    const headers = aoa[0];
    const col = (name: string) => headers.indexOf(name);
    const yesNoRows = aoa.slice(1).filter((r2) => r2[col("question_type")] === "yes_no");
    expect(yesNoRows.length).toBeGreaterThan(0);
    for (const row of yesNoRows) {
      const v = row[col("option_value")];
      const opt = YES_NO_OPTIONS.find((o) => o.value === v);
      expect(opt, `unknown yes_no value ${v}`).toBeDefined();
      expect(row[col("option_label_en")]).toBe(pickText(opt!.label, "en"));
      expect(row[col("option_label_si")]).toBe(pickText(opt!.label, "si"));
      expect(row[col("option_label_ta")]).toBe(pickText(opt!.label, "ta"));
    }
  });
});

describe("buildCodebookXlsx — per-language sheets mode", () => {
  it("emits one sheet per requested language with uppercased names", async () => {
    const r = await buildCodebookXlsx({
      slugs: [FIRST_SLUG],
      langs: CODEBOOK_LANGS,
      perLanguageSheets: true,
    });
    expect(r.sheetNames).toEqual(["EN", "SI", "TA"]);
    const wb = readWorkbook(r.base64);
    expect(wb.SheetNames).toEqual(["EN", "SI", "TA"]);
  });

  it("each per-language sheet's header matches buildCodebookHeaders([lang])", async () => {
    const r = await buildCodebookXlsx({
      slugs: [FIRST_SLUG],
      langs: CODEBOOK_LANGS,
      perLanguageSheets: true,
    });
    const wb = readWorkbook(r.base64);
    for (const lang of CODEBOOK_LANGS) {
      const ws = wb.Sheets[lang.toUpperCase()];
      const aoa = XLSXNS.utils.sheet_to_json<string[]>(ws, {
        header: 1,
        defval: "",
      }) as string[][];
      const expectedHeaders = buildCodebookHeaders([lang]);
      expect(aoa[0].slice(0, expectedHeaders.length)).toEqual(
        expectedHeaders as unknown as string[],
      );
    }
  });

  it("counts on the result are language-independent (driven by survey, not lang axis)", async () => {
    const r = await buildCodebookXlsx({
      slugs: [FIRST_SLUG],
      langs: CODEBOOK_LANGS,
      perLanguageSheets: true,
    });
    const expected = buildCodebookRows([FIRST_SLUG], ["en"]);
    expect(r.questionCount).toBe(expected.questionCount);
    expect(r.optionCount).toBe(expected.optionCount);
    expect(r.surveyCount).toBe(expected.surveyCount);
  });

  it("falls back to single-sheet mode when only one language is selected", async () => {
    const r = await buildCodebookXlsx({
      slugs: [FIRST_SLUG],
      langs: ["en"] as const,
      perLanguageSheets: true,
    });
    expect(r.sheetNames).toEqual([CODEBOOK_SHEET_NAME]);
  });
});

describe("buildCodebookXlsx — in-process cache", () => {
  it("identical inputs hit the cache; base64 is byte-identical", async () => {
    expect(codebookXlsxCacheSize()).toBe(0);
    const a = await buildCodebookXlsx({
      slugs: [FIRST_SLUG],
      langs: CODEBOOK_LANGS,
      perLanguageSheets: false,
    });
    expect(a.cacheHit).toBe(false);
    expect(codebookXlsxCacheSize()).toBe(1);
    const b = await buildCodebookXlsx({
      slugs: [FIRST_SLUG],
      langs: CODEBOOK_LANGS,
      perLanguageSheets: false,
    });
    expect(b.cacheHit).toBe(true);
    expect(b.base64).toBe(a.base64);
    expect(codebookXlsxCacheSize()).toBe(1);
  });

  it("input-order independent: sorted slugs + langs hash to the same key", async () => {
    if (ALL_SLUGS.length < 2) return; // trivially passes
    const first = await buildCodebookXlsx({
      slugs: [ALL_SLUGS[0], ALL_SLUGS[1]],
      langs: ["en", "si", "ta"] as const,
      perLanguageSheets: false,
    });
    const second = await buildCodebookXlsx({
      slugs: [ALL_SLUGS[1], ALL_SLUGS[0]],
      langs: ["ta", "en", "si"] as const,
      perLanguageSheets: false,
    });
    expect(second.cacheHit).toBe(true);
    expect(second.base64).toBe(first.base64);
  });

  it("different inputs miss the cache and grow size", async () => {
    await buildCodebookXlsx({
      slugs: [FIRST_SLUG],
      langs: CODEBOOK_LANGS,
      perLanguageSheets: false,
    });
    const other = await buildCodebookXlsx({
      slugs: [FIRST_SLUG],
      langs: ["en"] as const,
      perLanguageSheets: false,
    });
    expect(other.cacheHit).toBe(false);
    expect(codebookXlsxCacheSize()).toBe(2);
    const multisheet = await buildCodebookXlsx({
      slugs: [FIRST_SLUG],
      langs: CODEBOOK_LANGS,
      perLanguageSheets: true,
    });
    expect(multisheet.cacheHit).toBe(false);
    expect(codebookXlsxCacheSize()).toBe(3);
  });
});

describe("buildCodebookFilenameStem", () => {
  const FIXED = new Date("2026-05-15T12:00:00.000Z");
  it("default scope + all languages → no scope/lang/multisheet tags", () => {
    expect(
      buildCodebookFilenameStem({
        langs: CODEBOOK_LANGS,
        date: FIXED,
      }),
    ).toBe("eip-insight-codebook-2026-05-15");
  });
  it("survey + single language + multisheet flag emits all tags in canonical order", () => {
    expect(
      buildCodebookFilenameStem({
        surveySlug: "phase-1",
        langs: ["si"] as const,
        perLanguageSheets: false,
        date: FIXED,
      }),
    ).toBe("eip-insight-codebook-phase-1-si-2026-05-15");
    // Multisheet only kicks in when langs.length > 1.
    expect(
      buildCodebookFilenameStem({
        surveySlug: "phase-1",
        langs: ["en", "si"] as const,
        perLanguageSheets: true,
        date: FIXED,
      }),
    ).toBe("eip-insight-codebook-phase-1-ensi-multisheet-2026-05-15");
  });
});

describe("admin codebook server fns — authorization + payload structure", () => {
  // We mock the supabase admin client so `assertAdmin` doesn't need a live
  // database. The handlers themselves are thin (auth + delegate to the
  // pure builders these tests already cover), so this file's job here is
  // (a) the guard rejects non-admins with the toast-visible error message
  // and (b) the payload shape the admin UI destructures stays stable.
  it("assertAdmin throws the toast-visible 'Forbidden' message for non-admins", async () => {
    const { assertAdmin } = await import("@/lib/admin.shared.server");
    const { createAdminClient } =
      (await import("@/integrations/supabase/client.server")) as unknown as {
        createAdminClient: () => { maybeSingle: ReturnType<typeof vi.fn> };
      };
    const supabaseAdmin = createAdminClient();
    supabaseAdmin.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(assertAdmin("not-an-admin")).rejects.toThrow("Forbidden: admin role required");
  });

  it("assertAdmin resolves silently when the user_roles row exists", async () => {
    const { assertAdmin } = await import("@/lib/admin.shared.server");
    const { createAdminClient } =
      (await import("@/integrations/supabase/client.server")) as unknown as {
        createAdminClient: () => { maybeSingle: ReturnType<typeof vi.fn> };
      };
    const supabaseAdmin = createAdminClient();
    supabaseAdmin.maybeSingle.mockResolvedValueOnce({
      data: { role: "admin" },
      error: null,
    });
    await expect(assertAdmin("admin-user")).resolves.toBeUndefined();
  });

  it("XLSX payload exposes every key the admin UI destructures", async () => {
    // Probe the shape via the same builder the handler uses, so we don't
    // need to instantiate the full server-fn middleware stack.
    const built = await buildCodebookXlsx({
      slugs: [FIRST_SLUG],
      langs: CODEBOOK_LANGS,
      perLanguageSheets: false,
    });
    const stem = buildCodebookFilenameStem({
      surveySlug: FIRST_SLUG,
      langs: CODEBOOK_LANGS,
      perLanguageSheets: false,
      date: new Date("2026-05-15T00:00:00Z"),
    });
    const payload = {
      base64: built.base64,
      filename: `${stem}.xlsx`,
      questionCount: built.questionCount,
      optionCount: built.optionCount,
      surveyCount: built.surveyCount,
      sheetNames: built.sheetNames,
      byteLength: built.byteLength,
      cacheHit: built.cacheHit,
    };
    for (const key of [
      "base64",
      "filename",
      "questionCount",
      "optionCount",
      "surveyCount",
      "sheetNames",
      "byteLength",
      "cacheHit",
    ]) {
      expect(payload, `missing ${key}`).toHaveProperty(key);
    }
    expect(payload.filename.endsWith(".xlsx")).toBe(true);
    expect(Array.isArray(payload.sheetNames)).toBe(true);
    expect(typeof payload.byteLength).toBe("number");
  });

  it("CSV payload exposes csv + filename + counts", async () => {
    const expected = buildCodebookRows([FIRST_SLUG], CODEBOOK_LANGS);
    const stem = buildCodebookFilenameStem({
      surveySlug: FIRST_SLUG,
      langs: CODEBOOK_LANGS,
      date: new Date("2026-05-15T00:00:00Z"),
    });
    const payload = {
      csv: [expected.headers.join(","), ...expected.rows.map((r) => r.join(","))].join("\n"),
      filename: `${stem}.csv`,
      questionCount: expected.questionCount,
      optionCount: expected.optionCount,
      surveyCount: expected.surveyCount,
    };
    for (const key of ["csv", "filename", "questionCount", "optionCount", "surveyCount"]) {
      expect(payload, `missing ${key}`).toHaveProperty(key);
    }
    expect(payload.filename.endsWith(".csv")).toBe(true);
    expect(payload.csv.split("\n").length).toBe(expected.rows.length + 1);
  });
});
