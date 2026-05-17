/**
 * Extended export builders: localized XLSX, section-grouped CSV, and a
 * per-response validation report. All three are pure (no I/O, no Supabase
 * client) so they can be unit-tested deterministically and the server
 * functions in `admin.functions.ts` only have to handle the workbook
 * encoding step.
 *
 * Column contract — kept in lockstep with `responses-csv.ts` so analysts
 * can join an export back to the response table by `id`:
 *   META   → id, status, language, progress_pct, started_at, completed_at,
 *            contact_name, contact_email, contact_org
 *   ANSWERS → one column per non-section_header question, in survey-declared
 *             order, localized to the chosen UI language.
 */
import type { Lang } from "@/lib/i18n";
import { pickText } from "@/lib/i18n";
import type { Survey, Question, Option } from "@/surveys/types";
import { RESPONSES_CSV_META_HEADERS, escapeCsvCell, type ResponseRow } from "@/lib/responses-csv";
import { isAnswered, isVisible } from "@/lib/survey-logic";

// ─── shared helpers ─────────────────────────────────────────────────────────

function localizeOptionValue(value: unknown, options: Option[] | undefined, lang: Lang): string {
  if (value == null) return "";
  if (!options || options.length === 0) return String(value);
  const hit = options.find((o) => o.value === String(value));
  return hit ? pickText(hit.label, lang) : String(value);
}

function localizeAnswerCell(q: Question, raw: unknown, lang: Lang): unknown {
  if (raw == null) return "";
  switch (q.type) {
    case "single_choice":
    case "yes_no":
    case "likert_5":
      return localizeOptionValue(raw, q.options, lang);
    case "multi_choice": {
      const arr = Array.isArray(raw) ? raw : [raw];
      return arr.map((v) => localizeOptionValue(v, q.options, lang)).join("; ");
    }
    default:
      return raw;
  }
}

function answerableQuestions(survey: Survey): Question[] {
  return survey.questions.filter((q) => q.type !== "section_header");
}

function metaRow(r: ResponseRow): unknown[] {
  const c = (r.contact ?? {}) as Record<string, unknown>;
  return [
    r.id,
    r.status,
    r.language,
    r.progress_pct,
    r.started_at,
    r.completed_at ?? "",
    c.name ?? "",
    c.email ?? "",
    c.organization ?? "",
  ];
}

// ─── 1. Section-grouped CSV ─────────────────────────────────────────────────
//
// Same row shape as `buildLocalizedResponsesCsv`, but each question's column
// header is prefixed with its localized section name in square brackets so
// recipients can group/pivot by section without losing the stable meta-column
// layout. Example:
//   "id", "status", "language", ... , "[Section 1] Role", "[Section 1] Sector"
//
// We keep it as a single header row (not a banded multi-row layout) so it
// stays valid CSV and round-trips through any spreadsheet tool without
// needing merged-cell support.

export function buildSectionedLocalizedResponsesCsv(
  rows: ResponseRow[],
  survey: Survey,
  lang: Lang,
): { csv: string; filename: string; rowCount: number } {
  const questions = answerableQuestions(survey);

  const localizedHeaders = questions.map((q) => {
    const section = pickText(q.section, lang).trim();
    const label = pickText(q.label, lang);
    return section ? `[${section}] ${label}` : label;
  });
  const headers = [...RESPONSES_CSV_META_HEADERS, ...localizedHeaders];

  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const r of rows) {
    const a = (r.answers ?? {}) as Record<string, unknown>;
    lines.push(
      [...metaRow(r), ...questions.map((q) => localizeAnswerCell(q, a[q.id], lang))]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  return {
    csv: lines.join("\n"),
    filename: `${survey.slug}-responses-sectioned-${lang}.csv`,
    rowCount: rows.length,
  };
}

// ─── 2. Localized XLSX (AOA pre-builder) ────────────────────────────────────
//
// We return an array-of-arrays plus a filename stem. The server function
// turns the AOA into a workbook via the `xlsx` package; tests assert the AOA
// shape directly so we don't need to spin up xlsx in vitest.

export function buildLocalizedResponsesXlsxAoa(
  rows: ResponseRow[],
  survey: Survey,
  lang: Lang,
): { aoa: unknown[][]; filename: string; rowCount: number } {
  const questions = answerableQuestions(survey);
  const headerRow: unknown[] = [
    ...RESPONSES_CSV_META_HEADERS,
    ...questions.map((q) => pickText(q.label, lang)),
  ];
  const dataRows = rows.map((r) => {
    const a = (r.answers ?? {}) as Record<string, unknown>;
    return [...metaRow(r), ...questions.map((q) => localizeAnswerCell(q, a[q.id], lang))];
  });
  return {
    aoa: [headerRow, ...dataRows],
    filename: `${survey.slug}-responses-${lang}.xlsx`,
    rowCount: rows.length,
  };
}

// ─── 3. Per-response validation report ─────────────────────────────────────
//
// For each response, walks every visible required question on the survey
// and records:
//   • `missing_required` — semicolon-separated list of `qid` whose answer
//     is empty (after `isAnswered`); ignores conditionally-hidden branches.
//   • `invalid_choice_codes` — semicolon-separated `qid=value` for any
//     value submitted to a single_choice / multi_choice / likert_5 / yes_no
//     question that isn't in the option set (typo / stale code).
//   • `is_valid` — boolean; true only when both lists are empty.
//
// Then appends the same localized answer columns as the standard export so
// the report doubles as a self-contained QA artifact.

const CHOICE_TYPES: ReadonlySet<Question["type"]> = new Set([
  "single_choice",
  "multi_choice",
  "likert_5",
  "yes_no",
]);

function collectInvalidCodes(survey: Survey, answers: Record<string, unknown>) {
  const out: string[] = [];
  for (const q of answerableQuestions(survey)) {
    if (!CHOICE_TYPES.has(q.type) || !q.options || q.options.length === 0) continue;
    const allowed = new Set(q.options.map((o) => o.value));
    const v = answers[q.id];
    if (v == null) continue;
    const values = Array.isArray(v) ? v : [v];
    for (const item of values) {
      const s = String(item);
      if (!s) continue;
      // Honor allowOther: any "other_*" / "other:..." value passes through.
      if (q.allowOther && (s === "other" || s.startsWith("other:") || s.startsWith("other_"))) {
        continue;
      }
      if (!allowed.has(s)) out.push(`${q.id}=${s}`);
    }
  }
  return out;
}

function collectMissingRequired(survey: Survey, answers: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const q of survey.questions) {
    if (q.type === "section_header") continue;
    if (!q.required) continue;
    if (!isVisible(q, answers)) continue;
    if (!isAnswered(q, answers)) {
      out.push(q.id);
      continue;
    }
    if (q.type === "multi_choice") {
      const v = answers[q.id];
      const arr = Array.isArray(v) ? v : [];
      const min = Math.max(q.minSelect ?? 0, 1);
      if (arr.length < min) out.push(q.id);
    }
  }
  return out;
}

const VALIDATION_HEADERS = ["is_valid", "missing_required", "invalid_choice_codes"] as const;

export function buildValidationReportCsv(
  rows: ResponseRow[],
  survey: Survey,
  lang: Lang,
): {
  csv: string;
  filename: string;
  rowCount: number;
  invalidCount: number;
} {
  const questions = answerableQuestions(survey);
  const headers = [
    ...RESPONSES_CSV_META_HEADERS,
    ...VALIDATION_HEADERS,
    ...questions.map((q) => pickText(q.label, lang)),
  ];
  const lines = [headers.map(escapeCsvCell).join(",")];
  let invalidCount = 0;

  for (const r of rows) {
    const a = (r.answers ?? {}) as Record<string, unknown>;
    const missing = collectMissingRequired(survey, a);
    const invalidCodes = collectInvalidCodes(survey, a);
    const isValid = missing.length === 0 && invalidCodes.length === 0;
    if (!isValid) invalidCount += 1;

    lines.push(
      [
        ...metaRow(r),
        isValid ? "true" : "false",
        missing.join("; "),
        invalidCodes.join("; "),
        ...questions.map((q) => localizeAnswerCell(q, a[q.id], lang)),
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  return {
    csv: lines.join("\n"),
    filename: `${survey.slug}-validation-report-${lang}.csv`,
    rowCount: rows.length,
    invalidCount,
  };
}
