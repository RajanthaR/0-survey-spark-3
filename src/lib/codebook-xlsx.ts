/**
 * Pure builder + small in-process cache for the codebook XLSX export.
 *
 * Extracted out of `src/lib/admin.functions.ts` so it can be unit tested
 * without spinning up Supabase / auth, and so the server fn handler can
 * stay thin (auth check + delegate). Survey definitions are static at
 * build time — so the cache key (slugs × langs × per-language flag) is a
 * total function of the inputs, and cached entries can live forever
 * (capped only to keep the working set bounded).
 *
 * Output contract:
 *   - `base64`  — `xlsx` workbook encoded with `btoa(binaryString)`,
 *                 safe to ship across the createServerFn RPC boundary.
 *   - `byteLength` — pre-base64 byte size of the workbook (so callers can
 *                    surface an "X KB" hint without decoding).
 *   - `sheetNames` — the sheets actually emitted, in workbook order.
 *                    `["Codebook"]` in single-sheet mode; one entry per
 *                    language (uppercased) in per-language mode.
 *   - `headerRow` — header row of the FIRST sheet. Pinned so callers
 *                   (and tests) can assert column shape without re-
 *                   parsing the workbook.
 *   - `cacheHit`  — true iff the result was served from the in-process
 *                   LRU instead of re-encoded; used by the toast caption
 *                   to surface "(cached)" without an extra round-trip.
 */
import {
  buildCodebookHeaders,
  buildCodebookRows,
  CODEBOOK_LANGS,
  type CodebookLang,
} from "@/lib/csv-export-shape";

export type CodebookXlsxInput = {
  /** Survey slugs to include. Empty means "every survey in the registry". */
  slugs: readonly string[];
  /** Languages to project. Defaults to EN+SI+TA when omitted. */
  langs: readonly CodebookLang[];
  /**
   * When true (and langs.length > 1), emit one sheet per language
   * (sheets named "EN", "SI", "TA"); each sheet is the codebook scoped
   * to that single language so analysts can hand a single-language
   * sheet to a single-language reviewer. When false, the workbook
   * carries one merged "Codebook" sheet with all selected language
   * columns side-by-side (the historical shape).
   */
  perLanguageSheets: boolean;
};

export type CodebookXlsxResult = {
  base64: string;
  byteLength: number;
  sheetNames: string[];
  headerRow: readonly string[];
  questionCount: number;
  optionCount: number;
  surveyCount: number;
  cacheHit: boolean;
};

/** Sheet name used in single-sheet (merged) mode. */
export const CODEBOOK_SHEET_NAME = "Codebook";

/** Convert an `xlsx` ArrayBuffer to base64 in fixed-size chunks (Worker-safe). */
function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)),
    );
  }
  return btoa(bin);
}

/**
 * Apply the canonical "frozen + bolded header row" + "auto-ish column
 * width" formatting the codebook UI relies on. Centralized so single-
 * sheet and per-language sheet paths produce byte-identical formatting.
 */
function formatCodebookSheet(
  XLSX: typeof import("xlsx"),
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): import("xlsx").WorkSheet {
  const aoa: (string | number)[][] = [
    headers as string[],
    ...rows.map((r) => [...r] as (string | number)[]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Freeze the header row (`ySplit: 1`) and bold every header cell. We
  // intentionally write to the proprietary `!freeze` view-state and the
  // per-cell `s` style — the same shape the historical handler used —
  // so existing reader expectations still hold.
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as unknown as never;
  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (cell) cell.s = { font: { bold: true } };
  }
  ws["!cols"] = headers.map((h, c) => {
    let max = String(h).length;
    for (const r of rows) {
      const v = r[c];
      if (v != null) max = Math.max(max, String(v).length);
    }
    return { wch: Math.min(40, Math.max(10, max + 2)) };
  });
  return ws;
}

// ── In-process LRU cache ─────────────────────────────────────────────

const CACHE_LIMIT = 32;
type CacheValue = Omit<CodebookXlsxResult, "cacheHit">;
const cache = new Map<string, CacheValue>();

function cacheKey(input: CodebookXlsxInput): string {
  // Sort slugs + langs so the same logical request produces the same
  // key regardless of input ordering. JSON.stringify is enough since
  // every field is a primitive / array of primitives.
  const slugs = [...input.slugs].sort();
  const langs = [...input.langs].sort();
  return JSON.stringify({
    slugs,
    langs,
    perLanguageSheets: input.perLanguageSheets,
  });
}

/** Test seam: drop every cached entry. */
export function clearCodebookXlsxCache(): void {
  cache.clear();
}

/** Test seam: number of cached entries. */
export function codebookXlsxCacheSize(): number {
  return cache.size;
}

/**
 * Build the codebook XLSX, returning its base64-encoded body plus
 * structural metadata. Hits the in-process cache on identical inputs.
 */
export async function buildCodebookXlsx(
  input: CodebookXlsxInput,
): Promise<CodebookXlsxResult> {
  const key = cacheKey(input);
  const cached = cache.get(key);
  if (cached) {
    // LRU touch: re-insert to bump recency.
    cache.delete(key);
    cache.set(key, cached);
    return { ...cached, cacheHit: true };
  }

  const langs: readonly CodebookLang[] =
    input.langs.length > 0 ? input.langs : CODEBOOK_LANGS;
  const slugs = input.slugs;

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  let headerRow: readonly string[] = [];
  let questionCount = 0;
  let optionCount = 0;
  let surveyCount = 0;
  const sheetNames: string[] = [];

  if (input.perLanguageSheets && langs.length > 1) {
    // Per-language mode: one sheet per language, each carrying the
    // codebook projected to that single language. Question / option /
    // survey counts are taken from the FIRST language's sheet — they
    // are language-independent (driven by the survey definitions, not
    // the language axis), so any sheet would yield the same numbers.
    let first = true;
    for (const lang of langs) {
      const built = buildCodebookRows(slugs, [lang]);
      const ws = formatCodebookSheet(XLSX, built.headers, built.rows);
      const name = lang.toUpperCase();
      XLSX.utils.book_append_sheet(wb, ws, name);
      sheetNames.push(name);
      if (first) {
        headerRow = built.headers;
        questionCount = built.questionCount;
        optionCount = built.optionCount;
        surveyCount = built.surveyCount;
        first = false;
      }
    }
  } else {
    const built = buildCodebookRows(slugs, langs);
    const ws = formatCodebookSheet(XLSX, built.headers, built.rows);
    XLSX.utils.book_append_sheet(wb, ws, CODEBOOK_SHEET_NAME);
    sheetNames.push(CODEBOOK_SHEET_NAME);
    headerRow = built.headers;
    questionCount = built.questionCount;
    optionCount = built.optionCount;
    surveyCount = built.surveyCount;
  }

  const buf: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const base64 = bufferToBase64(buf);

  const value: CacheValue = {
    base64,
    byteLength: buf.byteLength,
    sheetNames,
    headerRow,
    questionCount,
    optionCount,
    surveyCount,
  };
  // Evict oldest entry if at capacity (Map preserves insertion order).
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
  return { ...value, cacheHit: false };
}

/**
 * Build the canonical codebook filename stem. Mirrors the rule used by
 * the CSV export: `eip-insight-codebook[-{slug}][-{langs}][-multisheet]
 * -{YYYY-MM-DD}`. Suffix-free so callers add `.xlsx` / `.csv`.
 */
export function buildCodebookFilenameStem(opts: {
  surveySlug?: string;
  langs: readonly CodebookLang[];
  perLanguageSheets?: boolean;
  date?: Date;
}): string {
  const stamp = (opts.date ?? new Date()).toISOString().slice(0, 10);
  const scope =
    opts.surveySlug && opts.surveySlug !== "__all__"
      ? `-${opts.surveySlug}`
      : "";
  const langTag =
    opts.langs.length === CODEBOOK_LANGS.length ? "" : `-${opts.langs.join("")}`;
  const multi =
    opts.perLanguageSheets && opts.langs.length > 1 ? "-multisheet" : "";
  return `eip-insight-codebook${scope}${langTag}${multi}-${stamp}`;
}

/**
 * Re-export so consumers of this module don't need to also import
 * `csv-export-shape` for the headers helper.
 */
export { buildCodebookHeaders, CODEBOOK_LANGS, type CodebookLang };
