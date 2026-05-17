/**
 * Admin export server functions (CSV / XLSX / streaming / codebook / zip).
 * Extracted from admin.functions.ts (D21). Helpers (assertAdmin,
 * fetchSurveyResponseRows, localizedExportSchema, streaming impls,
 * filteredExportSchema, buildFilteredExportRows, assembleZipBundle) live
 * in admin.shared.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createAdminClient } from "@/integrations/supabase/client.server";
import { SURVEYS } from "@/surveys";
import {
  buildExportColumns,
  buildExportHeaderRow,
  CODEBOOK_LANGS,
  type CodebookLang,
} from "@/lib/csv-export-shape";
import { buildCodebookRows } from "@/lib/csv-export-shape";
import { buildCodebookXlsx, buildCodebookFilenameStem } from "@/lib/codebook-xlsx";
import { buildResponsesCsv, type ResponseRow } from "@/lib/responses-csv";
import {
  assertAdmin,
  fetchSurveyResponseRows,
  localizedExportSchema,
  streamAllValidCsvImpl,
  streamAllValidXlsxImpl,
  StreamAllValidInputSchema,
  type StreamAllValidInput,
  type FilteredExportInput,
  filteredExportSchema,
  buildFilteredExportRows,
  assembleZipBundle,
} from "@/lib/admin.shared.server";

function adminClient() {
  return createAdminClient("admin.exports");
}

export const exportCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { surveySlug: string }) =>
    z.object({ surveySlug: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = adminClient();

    // Batched fetch — Postgres-side pagination so we can export beyond the
    // 1000-row default Supabase cap without loading everything in one query.
    const PAGE = 500;
    const list: Record<string, unknown>[] = [];
    for (let page = 0; page < 200; page += 1) {
      const { data: chunk, error } = await supabaseAdmin
        .from("responses")
        .select("*")
        .eq("survey_slug", data.surveySlug)
        .order("started_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw new Error(error.message);
      const rows = chunk ?? [];
      list.push(...(rows as Record<string, unknown>[]));
      if (rows.length < PAGE) break;
    }

    return buildResponsesCsv(list as ResponseRow[], data.surveySlug);
  });

// ── Localized exports (sectioned CSV / XLSX / validation report) ────────────
//
// Three sibling exports that share the per-survey fetch loop. Kept thin: the
// pure builders in `@/lib/exports-extended` produce the rows; this file only
// owns the auth check, the paginated fetch, and the XLSX encoding.

export const exportSectionedLocalizedCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { surveySlug: string; lang: "en" | "si" | "ta" }) =>
    localizedExportSchema.parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const survey = SURVEYS[data.surveySlug];
    if (!survey) throw new Error(`Unknown survey: ${data.surveySlug}`);
    const { buildSectionedLocalizedResponsesCsv } = await import("@/lib/exports-extended");
    const rows = await fetchSurveyResponseRows(data.surveySlug);
    return buildSectionedLocalizedResponsesCsv(rows, survey, data.lang);
  });

export const exportLocalizedXlsx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { surveySlug: string; lang: "en" | "si" | "ta" }) =>
    localizedExportSchema.parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const survey = SURVEYS[data.surveySlug];
    if (!survey) throw new Error(`Unknown survey: ${data.surveySlug}`);
    const { buildLocalizedResponsesXlsxAoa } = await import("@/lib/exports-extended");
    const rows = await fetchSurveyResponseRows(data.surveySlug);
    const built = buildLocalizedResponsesXlsxAoa(rows, survey, data.lang);

    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(built.aoa as (string | number)[][]);
    ws["!freeze"] = { xSplit: 0, ySplit: 1 } as unknown as never;
    for (let c = 0; c < (built.aoa[0]?.length ?? 0); c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      const cell = ws[addr];
      if (cell) cell.s = { font: { bold: true } };
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Responses");
    const buf: ArrayBuffer = XLSX.write(wb, {
      type: "array",
      bookType: "xlsx",
    });
    const bytes = new Uint8Array(buf);
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
    }
    return {
      base64: btoa(bin),
      filename: built.filename,
      rowCount: built.rowCount,
    };
  });

export const exportValidationReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { surveySlug: string; lang: "en" | "si" | "ta" }) =>
    localizedExportSchema.parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const survey = SURVEYS[data.surveySlug];
    if (!survey) throw new Error(`Unknown survey: ${data.surveySlug}`);
    const { buildValidationReportCsv } = await import("@/lib/exports-extended");
    const rows = await fetchSurveyResponseRows(data.surveySlug);
    return buildValidationReportCsv(rows, survey, data.lang);
  });

/**
 * Export every *valid* (completed) response across every known survey as a
 * single CSV. Question columns are namespaced `<slug>.<qid>` so questions
 * from different surveys don't collide, and each question header embeds
 * multilingual metadata: `slug.qid [type] | section EN/SI/TA | EN: … | SI: … | TA: …`.
 * Choice/likert/yes_no values are written as raw value codes (machine-friendly);
 * a sibling `*.label_en` column writes the English option label for analysts.
 */
export const exportAllValidCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = adminClient();

    // Pull every completed response, paginated past the 1000-row cap.
    const PAGE = 500;
    const list: Record<string, unknown>[] = [];
    for (let page = 0; page < 400; page += 1) {
      const { data: chunk, error } = await supabaseAdmin
        .from("responses")
        .select(
          "id, survey_slug, language, status, progress_pct, started_at, completed_at, contact, answers",
        )
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw new Error(error.message);
      const rows = chunk ?? [];
      list.push(...(rows as Record<string, unknown>[]));
      if (rows.length < PAGE) break;
    }

    const cols = buildExportColumns();
    const headerRow = buildExportHeaderRow(cols);

    const escape = (v: unknown) => {
      if (v == null) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines: string[] = [headerRow.map(escape).join(",")];
    for (const r of list) {
      const slug = String(r.survey_slug ?? "");
      const answers = (r.answers ?? {}) as Record<string, unknown>;
      const c = (r.contact ?? {}) as Record<string, unknown>;
      const startedAt = r.started_at ? new Date(String(r.started_at)) : null;
      const completedAt = r.completed_at ? new Date(String(r.completed_at)) : null;
      const durationSec =
        startedAt && completedAt
          ? Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000))
          : "";

      const row: unknown[] = [
        slug,
        r.id,
        r.status,
        r.language,
        r.progress_pct,
        r.started_at,
        r.completed_at ?? "",
        durationSec,
        c.name ?? "",
        c.email ?? "",
        c.organization ?? "",
      ];

      for (const col of cols) {
        if (col.slug !== slug) {
          row.push("");
          if (col.labelKey) row.push("");
          continue;
        }
        const val = answers[col.qid];
        row.push(val == null ? "" : val);
        if (col.labelKey) {
          if (val == null) {
            row.push("");
          } else if (Array.isArray(val)) {
            row.push(val.map((v) => col.optionLabelEn?.get(String(v)) ?? String(v)).join("; "));
          } else {
            row.push(col.optionLabelEn?.get(String(val)) ?? String(val));
          }
        }
      }
      lines.push(row.map(escape).join(","));
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return {
      csv: lines.join("\n"),
      filename: `eip-insight-all-valid-responses-${stamp}.csv`,
      rowCount: list.length,
    };
  });

/**
 * Streaming variant of `exportAllValidCsv`. Yields a `meta` event up front
 * (total row count, filename, header row), then a `chunk` event per page of
 * 500 rows with the rendered CSV slice + cumulative progress, then a final
 * `done` event. The admin UI consumes this via `for await` to render a live
 * progress bar and accumulates the chunks into a single Blob for download.
 */
/**
 * Event protocol for the streaming all-valid CSV export.
 *
 * Sequence guarantees (verified by `streamAllValidCsv.protocol.test.ts`):
 *   - Exactly one `meta` event, emitted first.
 *   - Zero or more `chunk` events with monotonically-increasing `processed`
 *     bounded by `total`. Each chunk's `csv` is a complete `\n`-terminated
 *     CSV slice (no header row — that lives on the `meta` event).
 *   - Exactly one `done` event, emitted last, with the final `rowCount`.
 *   - `warn` events may be interleaved on retry, but never after `done`.
 */

export const streamAllValidCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StreamAllValidInput) => StreamAllValidInputSchema.parse(input))
  .handler(async function* ({ context, data }) {
    await assertAdmin(context.userId);
    const supabaseAdmin = adminClient();
    const opts = data ?? {};
    // Stamp every server log with the requestId so admins can grep
    // worker logs by the value the UI shows them.
    const requestId =
      opts.requestId ??
      (typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    console.info(
      `[stream-export] start requestId=${requestId} startPage=${opts.startPage ?? 0} maxAttempts=${opts.maxAttempts ?? 3} baseDelayMs=${opts.baseDelayMs ?? 300} backoffFactor=${opts.backoffFactor ?? 3} userId=${context.userId}`,
    );
    yield* streamAllValidCsvImpl({
      countCompleted: async () => {
        const { count, error } = await supabaseAdmin
          .from("responses")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed");
        if (error) throw new Error(error.message);
        return count ?? 0;
      },
      fetchPage: async (page, pageSize) => {
        const { data: chunk, error } = await supabaseAdmin
          .from("responses")
          .select(
            "id, survey_slug, language, status, progress_pct, started_at, completed_at, contact, answers",
          )
          .eq("status", "completed")
          .order("started_at", { ascending: false })
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (error) throw new Error(error.message);
        return (chunk ?? []) as Record<string, unknown>[];
      },
      startPage: opts.startPage,
      maxAttempts: opts.maxAttempts,
      baseDelayMs: opts.baseDelayMs,
      backoffFactor: opts.backoffFactor,
      requestId,
    });
  });

export const streamAllValidXlsx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StreamAllValidInput) => StreamAllValidInputSchema.parse(input))
  .handler(async function* ({ context, data }) {
    await assertAdmin(context.userId);
    const supabaseAdmin = adminClient();
    const opts = data ?? {};
    const requestId =
      opts.requestId ??
      (typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    console.info(
      `[stream-export-xlsx] start requestId=${requestId} startPage=${opts.startPage ?? 0} userId=${context.userId}`,
    );
    yield* streamAllValidXlsxImpl({
      countCompleted: async () => {
        const { count, error } = await supabaseAdmin
          .from("responses")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed");
        if (error) throw new Error(error.message);
        return count ?? 0;
      },
      fetchPage: async (page, pageSize) => {
        const { data: chunk, error } = await supabaseAdmin
          .from("responses")
          .select(
            "id, survey_slug, language, status, progress_pct, started_at, completed_at, contact, answers",
          )
          .eq("status", "completed")
          .order("started_at", { ascending: false })
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (error) throw new Error(error.message);
        return (chunk ?? []) as Record<string, unknown>[];
      },
      startPage: opts.startPage,
      maxAttempts: opts.maxAttempts,
      baseDelayMs: opts.baseDelayMs,
      backoffFactor: opts.backoffFactor,
      requestId,
    });
  });

/**
 * Export a multilingual *codebook* describing every survey, every question,
 * and every option code. One row per option for choice/likert/yes_no
 * questions; one summary row per non-choice question. Columns:
 *   survey_slug, survey_title_{en|si|ta},
 *   question_id, question_type, required, section_{en|si|ta},
 *   question_label_{en|si|ta},
 *   option_value, option_label_{en|si|ta},
 *   shown_if (raw JSON of the visibility rule, if any),
 *   max_select (multi_choice cap)
 *
 * Analysts join this codebook against the value codes in the responses CSV
 * exports to read answers in any of the three languages.
 */
export const exportCodebookCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { surveySlug?: string; langs?: CodebookLang[] } | undefined) => input ?? {},
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const slug = data?.surveySlug;
    const slugs = slug && slug !== "__all__" ? [slug] : (Object.keys(SURVEYS) as string[]);
    if (slug && slug !== "__all__" && !SURVEYS[slug]) {
      throw new Error(`Unknown survey: ${slug}`);
    }

    const requested = data?.langs?.filter((l) => CODEBOOK_LANGS.includes(l));
    const langs: readonly CodebookLang[] =
      requested && requested.length > 0 ? requested : CODEBOOK_LANGS;

    const { headers, rows, questionCount, optionCount, surveyCount } = buildCodebookRows(
      slugs,
      langs,
    );
    const escape = (v: unknown) => {
      if (v == null) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [headers.join(",")];
    for (const r of rows) lines.push(r.map(escape).join(","));

    const stamp = new Date().toISOString().slice(0, 10);
    const scope = slug && slug !== "__all__" ? `-${slug}` : "";
    const langTag = langs.length === CODEBOOK_LANGS.length ? "" : `-${langs.join("")}`;
    return {
      csv: lines.join("\n"),
      filename: `eip-insight-codebook${scope}${langTag}-${stamp}.csv`,
      questionCount,
      optionCount,
      surveyCount,
    };
  });

/**
 * Same multilingual codebook as `exportCodebookCsv`, delivered as an `.xlsx`
 * workbook (a single "Codebook" sheet, header row frozen + bolded). The
 * binary is base64-encoded for transport across the RPC boundary; the client
 * decodes and saves it. Survey-scope and language-filter inputs match the
 * CSV variant 1:1 so the two exports stay in lockstep.
 */
export const exportCodebookXlsx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      input:
        | {
            surveySlug?: string;
            langs?: CodebookLang[];
            perLanguageSheets?: boolean;
          }
        | undefined,
    ) => input ?? {},
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const slug = data?.surveySlug;
    const slugs = slug && slug !== "__all__" ? [slug] : (Object.keys(SURVEYS) as string[]);
    if (slug && slug !== "__all__" && !SURVEYS[slug]) {
      throw new Error(`Unknown survey: ${slug}`);
    }

    const requested = data?.langs?.filter((l) => CODEBOOK_LANGS.includes(l));
    const langs: readonly CodebookLang[] =
      requested && requested.length > 0 ? requested : CODEBOOK_LANGS;
    const perLanguageSheets = data?.perLanguageSheets === true;

    const built = await buildCodebookXlsx({
      slugs,
      langs,
      perLanguageSheets,
    });

    const stem = buildCodebookFilenameStem({
      surveySlug: slug,
      langs,
      perLanguageSheets,
    });
    return {
      base64: built.base64,
      filename: `${stem}.xlsx`,
      questionCount: built.questionCount,
      optionCount: built.optionCount,
      surveyCount: built.surveyCount,
      sheetNames: built.sheetNames,
      byteLength: built.byteLength,
      cacheHit: built.cacheHit,
    };
  });

/**
 * Live preview for the filtered export. Returns how many response rows
 * match the current filter set without building the CSV. When `validOnly`
 * is false, this is a single `count: 'exact', head: true` query (fast).
 * When `validOnly` is true, we have to fetch answers + status to evaluate
 * the per-survey required-question contract, but we still skip CSV
 * assembly so the UI can debounce-call this on every filter change.
 */

/**
 * Filtered response export. Lets admins narrow the CSV to a single survey,
 * a language, a `started_at` OR `completed_at` date range, and/or
 * completed-only responses. Same multilingual column layout as
 * exportAllValidCsv so analysts can use the same codebook to decode it.
 */
export const exportFilteredCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: FilteredExportInput) => filteredExportSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = adminClient();

    const built = await buildFilteredExportRows(data);

    const escape = (v: unknown) => {
      if (v == null) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines: string[] = [built.headerRow.map(escape).join(",")];
    for (const row of built.dataRows) lines.push(row.map(escape).join(","));

    return {
      csv: lines.join("\n"),
      filename: `${built.filenameStem}.csv`,
      rowCount: built.rowCount,
      totalFetched: built.totalFetched,
      droppedInvalid: built.droppedInvalid,
      droppedUnknownSurvey: built.droppedUnknownSurvey,
    };
  });

/**
 * Filtered response export, XLSX flavor. Same fetch + filter as
 * `exportFilteredCsv` (so row counts and ordering are byte-equivalent),
 * but serialized into a single-sheet `.xlsx` workbook with a frozen +
 * bolded header row. Returned as a base64 payload because the
 * createServerFn JSON envelope can't carry binary directly.
 */
export const exportFilteredXlsx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: FilteredExportInput) => filteredExportSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const built = await buildFilteredExportRows(data);

    const XLSX = await import("xlsx");
    const aoa: unknown[][] = [built.headerRow, ...built.dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa as (string | number)[][]);
    ws["!freeze"] = { xSplit: 0, ySplit: 1 } as unknown as never;
    for (let c = 0; c < built.headerRow.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      const cell = ws[addr];
      if (cell) cell.s = { font: { bold: true } };
    }
    // Column widths sized to a 500-row sample (full scans get expensive on
    // large exports and the cap clamps the result anyway).
    ws["!cols"] = built.headerRow.map((h, c) => {
      let max = String(h).length;
      const sampleLimit = Math.min(built.dataRows.length, 500);
      for (let i = 0; i < sampleLimit; i++) {
        const v = built.dataRows[i][c];
        if (v != null) max = Math.max(max, String(v).length);
      }
      return { wch: Math.min(60, Math.max(10, max + 2)) };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Responses");
    const buf: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const bytes = new Uint8Array(buf);
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
    }
    const base64 = btoa(bin);

    return {
      base64,
      filename: `${built.filenameStem}.xlsx`,
      rowCount: built.rowCount,
      totalFetched: built.totalFetched,
      droppedInvalid: built.droppedInvalid,
      droppedUnknownSurvey: built.droppedUnknownSurvey,
    };
  });

/**
 * Bundle export: builds one CSV per survey plus a summary CSV that lists
 * counts and language splits per survey, then a codebook CSV. Honors the
 * **same admin filter set** as `exportFilteredCsv` (survey selection,
 * language, date range / dateField, status / validOnly) so the bundle
 * mirrors what the operator sees in the dashboard instead of being
 * permanently locked to "completed responses across every survey".
 *
 * Returned as a JSON payload of files; the admin UI zips them client-side
 * with fflate so we avoid base64-inflating a binary blob over the
 * serverFn JSON envelope.
 */
export const exportZipBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: FilteredExportInput) => filteredExportSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = adminClient();

    const effectiveStatus: "completed" | "in_progress" | "all" = data.validOnly
      ? "completed"
      : (data.statusFilter ?? (data.completedOnly ? "completed" : "all"));
    const dateCol = data.dateField;

    const PAGE = 500;
    const slugs = data.surveySlug
      ? Object.keys(SURVEYS).filter((s) => s === data.surveySlug)
      : Object.keys(SURVEYS);
    const rowsBySlug: Record<string, Record<string, unknown>[]> = {};

    for (const slug of slugs) {
      const rows: Record<string, unknown>[] = [];
      for (let page = 0; page < 400; page += 1) {
        let q = supabaseAdmin
          .from("responses")
          .select(
            "id, survey_slug, language, status, progress_pct, started_at, completed_at, contact, answers",
          )
          .eq("survey_slug", slug)
          .order("started_at", { ascending: false })
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (effectiveStatus !== "all") q = q.eq("status", effectiveStatus);
        if (data.language) q = q.eq("language", data.language);
        if (data.dateFrom) q = q.gte(dateCol, `${data.dateFrom}T00:00:00.000Z`);
        if (data.dateTo) q = q.lte(dateCol, `${data.dateTo}T23:59:59.999Z`);
        const { data: chunk, error } = await q;
        if (error) throw new Error(error.message);
        const got = (chunk ?? []) as Record<string, unknown>[];
        rows.push(...got);
        if (got.length < PAGE) break;
      }
      rowsBySlug[slug] = rows;
    }

    return assembleZipBundle({ data, rowsBySlug });
  });
