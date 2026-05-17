/**
 * Shared server-side helpers for the admin server functions.
 *
 * Per the `tanstack-serverfn-splitting` rule, sibling helpers in the same
 * `.functions.ts` file can break after the tss-serverfn-split transform.
 * Anything imported by more than one handler in a `.functions.ts` module
 * lives here so the handler files stay thin.
 *
 * Extracted from the monolithic admin.functions.ts as part of D21.
 * No behavior change vs. the pre-split file — line-for-line move.
 */
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SURVEYS } from "@/surveys";
import { isValidCompletedResponse } from "@/lib/survey-logic";
import { pickText } from "@/lib/i18n";
import {
  buildExportColumns,
  buildExportHeaderRow,
  buildCodebookRows,
} from "@/lib/csv-export-shape";
import type { ResponseRow } from "@/lib/responses-csv";
import { CRC32_INIT, crc32Update, crc32Hex, crc32OfBytes, utf8 } from "@/lib/checksum";
import { createHash } from "node:crypto";

export async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const localizedExportSchema = z.object({
  surveySlug: z.string().min(1).max(64),
  lang: z.enum(["en", "si", "ta"]),
});

export async function fetchSurveyResponseRows(surveySlug: string) {
  const PAGE = 500;
  const list: Record<string, unknown>[] = [];
  for (let page = 0; page < 200; page += 1) {
    const { data: chunk, error } = await supabaseAdmin
      .from("responses")
      .select("*")
      .eq("survey_slug", surveySlug)
      .order("started_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = chunk ?? [];
    list.push(...(rows as Record<string, unknown>[]));
    if (rows.length < PAGE) break;
  }
  return list as ResponseRow[];
}

export type StreamAllValidEvent =
  | {
      type: "meta";
      total: number;
      filename: string;
      headerLine: string;
      /** Server-generated correlation ID. Echoed in every `warn` event so
       *  the UI can match in-toast IDs to the matching server log lines. */
      requestId: string;
      /** Echoes the requested resume offset (0 on a fresh run). The chunk
       *  loop starts at this page, and `processed` on every subsequent
       *  chunk includes the implicit `startPage * pageSize` rows that
       *  were already streamed in the prior attempt. */
      startPage: number;
      /** Effective page size on the server — needed by the client so its
       *  resume math (`processed / pageSize`) matches the server's. */
      pageSize: number;
    }
  | {
      type: "chunk";
      csv: string;
      processed: number;
      total: number;
      /** Zero-based index of the page this chunk was fetched from.
       *  Resume sends `startPage = lastChunkPage + 1`. */
      page: number;
      /** CRC32 (hex, 8 chars) of the UTF-8 bytes of `csv`. The client
       *  recomputes and compares before appending the chunk so a wire
       *  flip is caught at chunk-grain instead of at end-of-file. */
      crc32: string;
      /** UTF-8 byte length of `csv`. Used by the client to sanity-check
       *  that the same bytes hashed by the server land in the buffer. */
      byteLength: number;
    }
  | {
      /** End-of-stream integrity envelope. Emitted exactly once, just
       *  before `done`, covering the entire assembled file (BOM +
       *  header line + every `chunk.csv` in emission order). The client
       *  recomputes both digests over its assembled buffer and aborts
       *  the download on mismatch. */
      type: "checksum";
      crc32: string;
      sha256: string;
      byteLength: number;
    }
  | { type: "done"; rowCount: number }
  | {
      type: "warn";
      label: string;
      attempt: number;
      maxAttempts: number;
      message: string;
      requestId: string;
    };

/** Injected dependencies for the streaming generator (real or fake). */
export interface StreamAllValidDeps {
  countCompleted(): Promise<number>;
  fetchPage(page: number, pageSize: number): Promise<Record<string, unknown>[]>;
  /** Sleep override; defaults to setTimeout. Pass `() => Promise.resolve()` in tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Date override for deterministic filename. */
  now?: () => Date;
  pageSize?: number;
  /** Retry budget per fetch step. Default: 3. */
  maxAttempts?: number;
  /** Base backoff in ms for the *first* retry. Default: 300. */
  baseDelayMs?: number;
  /** Multiplier applied to the base delay per attempt. Default: 3. */
  backoffFactor?: number;
  /** Resume from this zero-based page index (skips earlier pages). The
   *  caller is responsible for keeping the partial CSV from the prior
   *  attempt — the server only emits chunks from `startPage` onward. */
  startPage?: number;
  /** Correlation ID. If omitted, the impl generates one and echoes it
   *  back on the `meta`/`warn` events so the client can show it in the
   *  UI and the server can stamp it into log lines. */
  requestId?: string;
}

/**
 * Pure async generator that powers `streamAllValidCsv`. Extracted so it
 * can be unit-tested with fake `countCompleted` / `fetchPage` deps without
 * touching Supabase or the auth middleware.
 */
export async function* streamAllValidCsvImpl(
  deps: StreamAllValidDeps,
): AsyncGenerator<StreamAllValidEvent> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now ?? (() => new Date());
  const PAGE = deps.pageSize ?? 500;
  const maxAttempts = Math.max(1, Math.min(10, deps.maxAttempts ?? 3));
  const baseDelayMs = Math.max(0, Math.min(60_000, deps.baseDelayMs ?? 300));
  const backoffFactor = Math.max(1, Math.min(10, deps.backoffFactor ?? 3));
  const startPage = Math.max(0, Math.min(399, deps.startPage ?? 0));
  const requestId =
    deps.requestId ??
    (typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

  const cols = buildExportColumns();
  const headerRow = buildExportHeaderRow(cols);
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headerLine = headerRow.map(escape).join(",");

  type WarnEvent = Extract<StreamAllValidEvent, { type: "warn" }>;
  type Awaitable<T> = T | Promise<T>;
  async function* withRetry<T>(
    label: string,
    run: () => Awaitable<T>,
  ): AsyncGenerator<WarnEvent, T, void> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return (await run()) as T;
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (attempt === maxAttempts) break;
        yield { type: "warn", label, attempt, maxAttempts, message: msg, requestId };
        const base = baseDelayMs * backoffFactor ** (attempt - 1);
        const jitter = base * (0.8 + Math.random() * 0.4);
        await sleep(jitter);
      }
    }
    const orig = lastErr instanceof Error ? lastErr.message : String(lastErr);
    // Tag the thrown error with the requestId so the client's catch
    // branch can surface it in the failure toast even though the throw
    // itself can't ride the event channel.
    throw new Error(
      `${label} failed after ${maxAttempts} attempts [requestId=${requestId}]: ${orig || "unknown error"}`,
    );
  }

  const total = yield* withRetry("Counting completed responses", () => deps.countCompleted());
  const stamp = now().toISOString().slice(0, 10);
  const filename = `eip-insight-all-valid-responses-${stamp}.csv`;

  yield {
    type: "meta",
    total,
    filename,
    headerLine,
    requestId,
    startPage,
    pageSize: PAGE,
  };

  // Streaming integrity: a CRC32 + SHA-256 covering the wire-emitted
  // bytes (header line + every chunk.csv in emission order). The
  // client recomputes both over its assembled buffer (skipping the
  // client-side BOM) and aborts the download on mismatch. We seed the
  // hashes with the header line on a fresh run; on resume the client
  // already holds the prior chunks but the server still emits the same
  // logical stream from `startPage` onward, so the *full-file* digests
  // would only match a fresh-run buffer. To keep resume useful, the
  // checksum envelope only covers bytes emitted in this run — the
  // client compares it against the digest of the chunks it just
  // received (not the full reconstituted file).
  const sha = createHash("sha256");
  let crcState = CRC32_INIT;
  let runByteLength = 0;
  if (startPage === 0) {
    const headerBytes = utf8(headerLine + "\n");
    sha.update(headerBytes);
    crcState = crc32Update(crcState, headerBytes);
    runByteLength += headerBytes.byteLength;
  }

  if (total === 0) {
    const finalCrc = crc32Hex(crcState);
    const finalSha = sha.digest("hex");
    yield {
      type: "checksum",
      crc32: finalCrc,
      sha256: finalSha,
      byteLength: runByteLength,
    };
    yield { type: "done", rowCount: 0 };
    return;
  }

  // When resuming, the prior attempt already streamed `startPage * PAGE`
  // rows that the client kept in its partial buffer. We continue
  // counting from there so the progress bar advances the resumed run
  // smoothly instead of snapping back to zero.
  let processed = Math.min(total, startPage * PAGE);
  for (let page = startPage; page < 400; page += 1) {
    const rows = yield* withRetry(
      `Fetching page ${page + 1} (rows ${page * PAGE + 1}–${page * PAGE + PAGE})`,
      () => deps.fetchPage(page, PAGE),
    );
    if (rows.length === 0) break;

    const lines: string[] = [];
    for (const r of rows) {
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
          if (val == null) row.push("");
          else if (Array.isArray(val))
            row.push(val.map((v) => col.optionLabelEn?.get(String(v)) ?? String(v)).join("; "));
          else row.push(col.optionLabelEn?.get(String(val)) ?? String(val));
        }
      }
      lines.push(row.map(escape).join(","));
    }
    processed += rows.length;
    const csvText = lines.join("\n") + "\n";
    const csvBytes = utf8(csvText);
    const chunkCrc = crc32OfBytes(csvBytes);
    sha.update(csvBytes);
    crcState = crc32Update(crcState, csvBytes);
    runByteLength += csvBytes.byteLength;
    yield {
      type: "chunk",
      csv: csvText,
      processed,
      total,
      page,
      crc32: chunkCrc,
      byteLength: csvBytes.byteLength,
    };
    if (rows.length < PAGE) break;
  }

  const finalCrc = crc32Hex(crcState);
  const finalSha = sha.digest("hex");
  yield {
    type: "checksum",
    crc32: finalCrc,
    sha256: finalSha,
    byteLength: runByteLength,
  };
  yield { type: "done", rowCount: processed };
}

export const StreamAllValidInputSchema = z
  .object({
    startPage: z.number().int().min(0).max(399).optional(),
    maxAttempts: z.number().int().min(1).max(10).optional(),
    baseDelayMs: z.number().int().min(0).max(60_000).optional(),
    backoffFactor: z.number().min(1).max(10).optional(),
    requestId: z.string().min(8).max(128).optional(),
  })
  .optional();

export type StreamAllValidInput = z.infer<typeof StreamAllValidInputSchema>;

export type StreamAllValidXlsxEvent =
  | {
      type: "meta";
      total: number;
      filename: string;
      headerRow: string[];
      requestId: string;
      startPage: number;
      pageSize: number;
    }
  | {
      type: "chunk";
      rows: (string | number | boolean | null)[][];
      processed: number;
      total: number;
      page: number;
    }
  | { type: "done"; rowCount: number }
  | {
      type: "warn";
      label: string;
      attempt: number;
      maxAttempts: number;
      message: string;
      requestId: string;
    };

export type StreamAllValidXlsxDeps = StreamAllValidDeps;

export async function* streamAllValidXlsxImpl(
  deps: StreamAllValidXlsxDeps,
): AsyncGenerator<StreamAllValidXlsxEvent> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now ?? (() => new Date());
  const PAGE = deps.pageSize ?? 500;
  const maxAttempts = Math.max(1, Math.min(10, deps.maxAttempts ?? 3));
  const baseDelayMs = Math.max(0, Math.min(60_000, deps.baseDelayMs ?? 300));
  const backoffFactor = Math.max(1, Math.min(10, deps.backoffFactor ?? 3));
  const startPage = Math.max(0, Math.min(399, deps.startPage ?? 0));
  const requestId =
    deps.requestId ??
    (typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

  const cols = buildExportColumns();
  const headerRow = buildExportHeaderRow(cols);

  type WarnEvent = Extract<StreamAllValidXlsxEvent, { type: "warn" }>;
  type Awaitable<T> = T | Promise<T>;
  async function* withRetry<T>(
    label: string,
    run: () => Awaitable<T>,
  ): AsyncGenerator<WarnEvent, T, void> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return (await run()) as T;
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (attempt === maxAttempts) break;
        yield { type: "warn", label, attempt, maxAttempts, message: msg, requestId };
        const base = baseDelayMs * backoffFactor ** (attempt - 1);
        const jitter = base * (0.8 + Math.random() * 0.4);
        await sleep(jitter);
      }
    }
    const orig = lastErr instanceof Error ? lastErr.message : String(lastErr);
    throw new Error(
      `${label} failed after ${maxAttempts} attempts [requestId=${requestId}]: ${orig || "unknown error"}`,
    );
  }

  const total = yield* withRetry("Counting completed responses", () => deps.countCompleted());
  const stamp = now().toISOString().slice(0, 10);
  const filename = `eip-insight-all-valid-responses-${stamp}.xlsx`;

  yield {
    type: "meta",
    total,
    filename,
    headerRow,
    requestId,
    startPage,
    pageSize: PAGE,
  };

  if (total === 0) {
    yield { type: "done", rowCount: 0 };
    return;
  }

  let processed = Math.min(total, startPage * PAGE);
  for (let page = startPage; page < 400; page += 1) {
    const rows = yield* withRetry(
      `Fetching page ${page + 1} (rows ${page * PAGE + 1}–${page * PAGE + PAGE})`,
      () => deps.fetchPage(page, PAGE),
    );
    if (rows.length === 0) break;

    const out: (string | number | boolean | null)[][] = [];
    for (const r of rows) {
      const slug = String(r.survey_slug ?? "");
      const answers = (r.answers ?? {}) as Record<string, unknown>;
      const c = (r.contact ?? {}) as Record<string, unknown>;
      const startedAt = r.started_at ? new Date(String(r.started_at)) : null;
      const completedAt = r.completed_at ? new Date(String(r.completed_at)) : null;
      const durationSec =
        startedAt && completedAt
          ? Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000))
          : "";
      type Cell = string | number | boolean | null;
      const toCell = (v: unknown): Cell => {
        if (v == null) return "";
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
        return JSON.stringify(v);
      };
      const row: Cell[] = [
        slug,
        String(r.id ?? ""),
        String(r.status ?? ""),
        String(r.language ?? ""),
        typeof r.progress_pct === "number" ? r.progress_pct : Number(r.progress_pct ?? 0),
        String(r.started_at ?? ""),
        String(r.completed_at ?? ""),
        durationSec === "" ? "" : Number(durationSec),
        toCell(c.name),
        toCell(c.email),
        toCell(c.organization),
      ];
      for (const col of cols) {
        if (col.slug !== slug) {
          row.push("");
          if (col.labelKey) row.push("");
          continue;
        }
        const val = answers[col.qid];
        row.push(toCell(val));
        if (col.labelKey) {
          if (val == null) row.push("");
          else if (Array.isArray(val))
            row.push(val.map((v) => col.optionLabelEn?.get(String(v)) ?? String(v)).join("; "));
          else row.push(col.optionLabelEn?.get(String(val)) ?? String(val));
        }
      }
      out.push(row);
    }
    processed += rows.length;
    yield { type: "chunk", rows: out, processed, total, page };
    if (rows.length < PAGE) break;
  }

  yield { type: "done", rowCount: processed };
}

export function fillDays(
  from: string,
  to: string,
  counts: Map<string, number>,
): Array<{ date: string; count: number }> {
  const out: Array<{ date: string; count: number }> = [];
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10);
    out.push({ date: d, count: counts.get(d) ?? 0 });
  }
  return out;
}

export type FilteredExportInput = {
  surveySlug?: string;
  language?: string;
  dateFrom?: string;
  dateTo?: string;
  dateField?: "started_at" | "completed_at";
  completedOnly?: boolean;
  statusFilter?: "completed" | "in_progress" | "all";
  validOnly?: boolean;
};

export const filteredExportSchema = z.object({
  surveySlug: z.string().min(1).max(64).optional(),
  language: z.enum(["en", "si", "ta"]).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateField: z.enum(["started_at", "completed_at"]).default("started_at"),
  completedOnly: z.boolean().default(true),
  statusFilter: z.enum(["completed", "in_progress", "all"]).optional(),
  validOnly: z.boolean().default(false),
});

export async function buildFilteredExportRows(data: z.infer<typeof filteredExportSchema>): Promise<{
  headerRow: string[];
  dataRows: unknown[][];
  filenameStem: string;
  rowCount: number;
  totalFetched: number;
  droppedInvalid: number;
  droppedUnknownSurvey: number;
}> {
  // `validOnly` always implies `completed` (it requires every required
  // answer, which by definition only exists on completed responses).
  // Otherwise honor `statusFilter`; fall back to legacy `completedOnly`.
  const effectiveStatus: "completed" | "in_progress" | "all" = data.validOnly
    ? "completed"
    : (data.statusFilter ?? (data.completedOnly ? "completed" : "all"));
  const dateCol = data.dateField;

  const PAGE = 500;
  const list: Record<string, unknown>[] = [];
  for (let page = 0; page < 400; page += 1) {
    let q = supabaseAdmin
      .from("responses")
      .select(
        "id, survey_slug, language, status, progress_pct, started_at, completed_at, contact, answers",
      )
      .order("started_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (effectiveStatus !== "all") q = q.eq("status", effectiveStatus);
    if (data.surveySlug) q = q.eq("survey_slug", data.surveySlug);
    if (data.language) q = q.eq("language", data.language);
    if (data.dateFrom) q = q.gte(dateCol, `${data.dateFrom}T00:00:00.000Z`);
    if (data.dateTo) q = q.lte(dateCol, `${data.dateTo}T23:59:59.999Z`);
    const { data: chunk, error } = await q;
    if (error) throw new Error(error.message);

    const rows = chunk ?? [];
    list.push(...(rows as Record<string, unknown>[]));
    if (rows.length < PAGE) break;
  }

  const totalFetched = list.length;
  let droppedInvalid = 0;
  let droppedUnknownSurvey = 0;
  const filtered = data.validOnly
    ? list.filter((r) => {
        const slug = String(r.survey_slug ?? "");
        const survey = SURVEYS[slug];
        if (!survey) {
          droppedUnknownSurvey += 1;
          return false;
        }
        const answers = (r.answers ?? {}) as Record<string, unknown>;
        const ok = isValidCompletedResponse(survey, answers);
        if (!ok) droppedInvalid += 1;
        return ok;
      })
    : list;

  const slugs = data.surveySlug ? [data.surveySlug] : Object.keys(SURVEYS);
  const cols = buildExportColumns(slugs);
  const baseHeader = buildExportHeaderRow(cols);
  // Insert `is_valid_completed` immediately after the meta columns and
  // before the per-question columns, so analysts can pivot on it without
  // scrolling past the (potentially hundreds of) answer columns. Header
  // doc string mirrors the contract enforced server-side: a row is
  // "valid" iff its survey_slug resolves AND every visible required
  // question has a non-empty answer (same predicate `validOnly` filters
  // on). Under `validOnly: true` every emitted row is "true" by
  // construction; under `validOnly: false` the column is the cheapest
  // way to spot which completed responses would be dropped if the
  // analyst re-ran the export with the toggle on.
  const VALIDITY_HEADER =
    "is_valid_completed | true|false — passes isValidCompletedResponse (survey known + every visible required question answered)";
  // Human-readable mirror of the raw `status` meta column. Kept adjacent to
  // is_valid_completed (same insertion point) so the filtered-export shape
  // stays predictable: meta block → validity flag → status label → answers.
  const STATUS_LABEL_HEADER =
    "status_label | Completed|In progress|Other — human-readable label for the raw `status` meta column";
  const META_LEN = 11; // META_HEADERS.length, kept in sync with csv-export-shape.ts
  const headerRow: string[] = [
    ...baseHeader.slice(0, META_LEN),
    VALIDITY_HEADER,
    STATUS_LABEL_HEADER,
    ...baseHeader.slice(META_LEN),
  ];

  const dataRows: unknown[][] = [];
  for (const r of filtered) {
    const slug = String(r.survey_slug ?? "");
    const survey = SURVEYS[slug];
    const answers = (r.answers ?? {}) as Record<string, unknown>;
    const isValid =
      r.status === "completed" && survey ? isValidCompletedResponse(survey, answers) : false;
    const c = (r.contact ?? {}) as Record<string, unknown>;
    const startedAt = r.started_at ? new Date(String(r.started_at)) : null;
    const completedAt = r.completed_at ? new Date(String(r.completed_at)) : null;
    const durationSec =
      startedAt && completedAt
        ? Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000))
        : "";
    const statusLabel =
      r.status === "completed" ? "Completed" : r.status === "in_progress" ? "In progress" : "Other";
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
      isValid ? "true" : "false",
      statusLabel,
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
        if (val == null) row.push("");
        else if (Array.isArray(val))
          row.push(val.map((v) => col.optionLabelEn?.get(String(v)) ?? String(v)).join("; "));
        else row.push(col.optionLabelEn?.get(String(val)) ?? String(val));
      }
    }
    dataRows.push(row);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const statusPart = data.validOnly
    ? "valid-completed"
    : effectiveStatus === "completed"
      ? "completed"
      : effectiveStatus === "in_progress"
        ? "in-progress"
        : "all-statuses";
  const dateTag = dateCol === "completed_at" ? "completed" : "started";
  const parts = [
    data.surveySlug ?? "all-surveys",
    statusPart,
    data.language ?? "all-langs",
    `${dateTag}-${data.dateFrom ?? "any"}`,
    `${dateTag}-${data.dateTo ?? "any"}`,
    stamp,
  ];
  return {
    headerRow,
    dataRows,
    filenameStem: `eip-insight-${parts.join("_")}`,
    rowCount: filtered.length,
    totalFetched,
    droppedInvalid,
    droppedUnknownSurvey,
  };
}

export function assembleZipBundle(input: {
  data: z.infer<typeof filteredExportSchema>;
  rowsBySlug: Record<string, Record<string, unknown>[]>;
  /** Override `new Date()` for stable filename assertions in tests. */
  now?: Date;
}): {
  files: { name: string; csv: string }[];
  filename: string;
  surveyCount: number;
  totalRows: number;
} {
  const { data, rowsBySlug } = input;

  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const effectiveStatus: "completed" | "in_progress" | "all" = data.validOnly
    ? "completed"
    : (data.statusFilter ?? (data.completedOnly ? "completed" : "all"));
  const dateCol = data.dateField;

  const slugs = Object.keys(rowsBySlug);
  const files: { name: string; csv: string }[] = [];
  const summary: {
    slug: string;
    title_en: string;
    total: number;
    completed: number;
    in_progress: number;
    lang_en: number;
    lang_si: number;
    lang_ta: number;
    first_started_at: string;
    last_started_at: string;
  }[] = [];
  let totalIncluded = 0;

  for (const slug of slugs) {
    const survey = SURVEYS[slug];
    const rows = rowsBySlug[slug] ?? [];
    const cols = buildExportColumns([slug]);
    const headerRow = buildExportHeaderRow(cols);
    const includedRows =
      data.validOnly && survey
        ? rows.filter((r) =>
            isValidCompletedResponse(survey, (r.answers ?? {}) as Record<string, unknown>),
          )
        : rows;

    const lines: string[] = [headerRow.map(escape).join(",")];
    for (const r of includedRows) {
      const answers = (r.answers ?? {}) as Record<string, unknown>;
      const c = (r.contact ?? {}) as Record<string, unknown>;
      const startedAt = r.started_at ? new Date(String(r.started_at)) : null;
      const completedAt = r.completed_at ? new Date(String(r.completed_at)) : null;
      const durationSec =
        startedAt && completedAt
          ? Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000))
          : "";
      const out: unknown[] = [
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
        const val = answers[col.qid];
        out.push(val == null ? "" : val);
        if (col.labelKey) {
          if (val == null) out.push("");
          else if (Array.isArray(val))
            out.push(val.map((v) => col.optionLabelEn?.get(String(v)) ?? String(v)).join("; "));
          else out.push(col.optionLabelEn?.get(String(val)) ?? String(val));
        }
      }
      lines.push(out.map(escape).join(","));
    }
    files.push({ name: `${slug}.csv`, csv: "\uFEFF" + lines.join("\n") });
    totalIncluded += includedRows.length;

    const langCount = { en: 0, si: 0, ta: 0 } as Record<string, number>;
    let completed = 0;
    let firstStarted = "";
    let lastStarted = "";
    for (const r of includedRows) {
      const lng = String(r.language ?? "");
      if (lng in langCount) langCount[lng] += 1;
      if (r.status === "completed") completed += 1;
      const st = String(r.started_at ?? "");
      if (st) {
        if (!firstStarted || st < firstStarted) firstStarted = st;
        if (!lastStarted || st > lastStarted) lastStarted = st;
      }
    }
    summary.push({
      slug,
      title_en: survey ? pickText(survey.title, "en") : "",
      total: includedRows.length,
      completed,
      in_progress: includedRows.length - completed,
      lang_en: langCount.en,
      lang_si: langCount.si,
      lang_ta: langCount.ta,
      first_started_at: firstStarted,
      last_started_at: lastStarted,
    });
  }

  const cb = buildCodebookRows();
  const cbLines: string[] = [cb.headers.join(",")];
  for (const r of cb.rows) cbLines.push(r.map(escape).join(","));
  files.push({ name: "codebook.csv", csv: "\uFEFF" + cbLines.join("\n") });

  const filterParts = [
    `survey=${data.surveySlug ?? "all"}`,
    `language=${data.language ?? "all"}`,
    `status=${data.validOnly ? "valid-completed" : effectiveStatus}`,
    `date_field=${dateCol}`,
    `date_from=${data.dateFrom ?? "any"}`,
    `date_to=${data.dateTo ?? "any"}`,
  ];
  const summaryHeaders = [
    "survey_slug",
    "survey_title_en",
    "total_responses",
    "completed",
    "in_progress",
    "responses_en",
    "responses_si",
    "responses_ta",
    "first_started_at",
    "last_started_at",
  ];
  const summaryLines: string[] = [`# filters: ${filterParts.join(", ")}`, summaryHeaders.join(",")];
  for (const s of summary) {
    summaryLines.push(
      [
        s.slug,
        s.title_en,
        s.total,
        s.completed,
        s.in_progress,
        s.lang_en,
        s.lang_si,
        s.lang_ta,
        s.first_started_at,
        s.last_started_at,
      ]
        .map(escape)
        .join(","),
    );
  }
  files.unshift({ name: "summary.csv", csv: "\uFEFF" + summaryLines.join("\n") });

  const stamp = (input.now ?? new Date()).toISOString().slice(0, 10);
  const statusPart = data.validOnly
    ? "valid-completed"
    : effectiveStatus === "completed"
      ? "completed"
      : effectiveStatus === "in_progress"
        ? "in-progress"
        : "all-statuses";
  const dateTag = dateCol === "completed_at" ? "completed" : "started";
  const filenameParts = [
    data.surveySlug ?? "all-surveys",
    statusPart,
    data.language ?? "all-langs",
    `${dateTag}-${data.dateFrom ?? "any"}`,
    `${dateTag}-${data.dateTo ?? "any"}`,
    stamp,
  ];
  return {
    files,
    filename: `eip-insight-bundle_${filenameParts.join("_")}.zip`,
    surveyCount: slugs.length,
    totalRows: totalIncluded,
  };
}
