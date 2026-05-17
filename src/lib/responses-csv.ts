/**
 * Pure builder for the per-survey "Download CSV" admin export. Extracted so
 * we can run end-to-end tests that seed a known set of submitted responses,
 * render them through the same code path the admin Download button uses, and
 * verify the resulting CSV reproduces every submitted answer — without
 * spinning up Supabase or the createServerFn middleware pipeline.
 *
 * Output shape (must stay in lockstep with admin.functions.ts → exportCsv):
 *   - First row: fixed meta columns + sorted union of answer keys across rows
 *   - One body row per response, RFC-4180 escaped
 *   - Object/array answer values are JSON-encoded so they survive a single
 *     CSV cell without losing structure
 */
export type ResponseRow = {
  id: string;
  status: string;
  language: string;
  progress_pct: number | string;
  started_at: string;
  completed_at?: string | null;
  contact?: Record<string, unknown> | null;
  answers?: Record<string, unknown> | null;
};

export const RESPONSES_CSV_META_HEADERS = [
  "id",
  "status",
  "language",
  "progress_pct",
  "started_at",
  "completed_at",
  "contact_name",
  "contact_email",
  "contact_org",
] as const;

export function escapeCsvCell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildResponsesCsv(
  rows: ResponseRow[],
  surveySlug: string,
): { csv: string; filename: string; rowCount: number } {
  const keySet = new Set<string>();
  for (const r of rows) {
    const a = (r.answers ?? {}) as Record<string, unknown>;
    Object.keys(a).forEach((k) => keySet.add(k));
  }
  const answerKeys = Array.from(keySet).sort();
  const headers = [...RESPONSES_CSV_META_HEADERS, ...answerKeys];

  const lines = [headers.join(",")];
  for (const r of rows) {
    const a = (r.answers ?? {}) as Record<string, unknown>;
    const c = (r.contact ?? {}) as Record<string, unknown>;
    lines.push(
      [
        r.id,
        r.status,
        r.language,
        r.progress_pct,
        r.started_at,
        r.completed_at ?? "",
        c.name ?? "",
        c.email ?? "",
        c.organization ?? "",
        ...answerKeys.map((k) => a[k]),
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  return {
    csv: lines.join("\n"),
    filename: `${surveySlug}-responses.csv`,
    rowCount: rows.length,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Localized export
//
// `buildLocalizedResponsesCsv` is a sibling of `buildResponsesCsv` that emits
// the export in a chosen UI language: question labels become the column
// headers in that language, and choice-question answers (single_choice,
// multi_choice, yes_no, likert_5) have their stored option `value`s mapped
// to the option's localized `label`. Free-text answers pass through as-is.
//
// This is what the admin "Download CSV (English / Sinhala / Tamil)" buttons
// use so a recipient can read the export without having to look up codes.
// ────────────────────────────────────────────────────────────────────────────

import type { Lang, LocalizedString } from "@/lib/i18n";
import { pickText } from "@/lib/i18n";
import type { Survey, Question, Option } from "@/surveys/types";

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
      // text, long_text, email, tel, number_range, geo, pairwise_saaty, etc.
      // pass through unchanged so we keep their original shape.
      return raw;
  }
}

export function buildLocalizedResponsesCsv(
  rows: ResponseRow[],
  survey: Survey,
  lang: Lang,
): { csv: string; filename: string; rowCount: number } {
  // Only include answer columns for questions that this survey actually
  // defines, in survey-declared order — gives the recipient a stable column
  // ordering instead of alphabetical.
  const questions = survey.questions.filter((q) => q.type !== "section_header");

  const localizedHeaders = questions.map((q) => pickText(q.label, lang));
  const headers = [...RESPONSES_CSV_META_HEADERS, ...localizedHeaders];

  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const r of rows) {
    const a = (r.answers ?? {}) as Record<string, unknown>;
    const c = (r.contact ?? {}) as Record<string, unknown>;
    lines.push(
      [
        r.id,
        r.status,
        r.language,
        r.progress_pct,
        r.started_at,
        r.completed_at ?? "",
        c.name ?? "",
        c.email ?? "",
        c.organization ?? "",
        ...questions.map((q) => localizeAnswerCell(q, a[q.id], lang)),
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  return {
    csv: lines.join("\n"),
    filename: `${survey.slug}-responses-${lang}.csv`,
    rowCount: rows.length,
  };
}

// Re-export i18n type so consumers don't need a second import.
export type { Lang, LocalizedString };
