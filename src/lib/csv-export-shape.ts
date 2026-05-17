/**
 * Pure helpers describing the *shape* of the admin CSV exports — the column
 * order, header strings, and codebook rows. Extracted so the server fns
 * (`exportAllValidCsv`, `streamAllValidCsv`, `exportFilteredCsv`,
 * `exportCodebookCsv`) all share one source of truth, and so it can be unit
 * tested without spinning up Supabase / auth.
 *
 * Stability invariants tested in `src/lib/__tests__/csv-export-shape.test.ts`:
 *   1. Column order follows `Object.keys(SURVEYS)` × survey question order.
 *   2. Headers embed all three languages (EN/SI/TA) — never depend on the
 *      viewer's UI language.
 *   3. Choice / likert / yes_no questions get a sibling `*.label_en` column.
 *   4. Non-section_header questions always contribute exactly one data column
 *      (plus the optional label column).
 */

import { SURVEYS } from "@/surveys";
import { pickText } from "@/lib/i18n";
import { type Question, YES_NO_OPTIONS } from "@/surveys/types";

export type ExportColumn = {
  key: string;
  header: string;
  labelKey?: string;
  labelHeader?: string;
  slug: string;
  qid: string;
  kind: Question["type"];
  optionLabelEn?: Map<string, string>;
};

export const META_HEADERS = [
  "survey_slug",
  "response_id",
  "status",
  "language",
  "progress_pct",
  "started_at",
  "completed_at",
  "duration_seconds",
  "contact_name",
  "contact_email",
  "contact_org",
] as const;

/**
 * Build the question-column descriptors for the all-valid / filtered CSV
 * exports, in survey × question order. Pass an explicit `slugs` array to
 * scope the export to a subset of surveys (used by `exportFilteredCsv` when a
 * single survey is selected).
 */
export function buildExportColumns(
  slugs: readonly string[] = Object.keys(SURVEYS),
): ExportColumn[] {
  const cols: ExportColumn[] = [];
  for (const slug of slugs) {
    const survey = SURVEYS[slug];
    if (!survey) continue;
    for (const q of survey.questions) {
      if (q.type === "section_header") continue;
      const key = `${slug}.${q.id}`;
      const header =
        `${key} [${q.type}] | section EN: ${pickText(q.section, "en")} | SI: ${pickText(q.section, "si")} | TA: ${pickText(q.section, "ta")}` +
        ` | EN: ${pickText(q.label, "en")} | SI: ${pickText(q.label, "si")} | TA: ${pickText(q.label, "ta")}`;
      const col: ExportColumn = { key, header, slug, qid: q.id, kind: q.type };
      if (q.options && q.options.length) {
        col.optionLabelEn = new Map(q.options.map((o) => [o.value, pickText(o.label, "en")]));
        col.labelKey = `${key}.label_en`;
        col.labelHeader = `${key}.label_en | English label for selected option(s)`;
      }
      cols.push(col);
    }
  }
  return cols;
}

/** Full ordered header row including META_HEADERS + question + label columns. */
export function buildExportHeaderRow(cols: ExportColumn[]): string[] {
  const headerRow: string[] = [...META_HEADERS];
  for (const c of cols) {
    headerRow.push(c.header);
    if (c.labelHeader) headerRow.push(c.labelHeader);
  }
  return headerRow;
}

// ---------- Codebook ----------

export const CODEBOOK_LANGS = ["en", "si", "ta"] as const;
export type CodebookLang = (typeof CODEBOOK_LANGS)[number];

const ALL_CODEBOOK_HEADERS = [
  "survey_slug",
  "survey_title_en",
  "survey_title_si",
  "survey_title_ta",
  "question_id",
  "question_type",
  "required",
  "section_en",
  "section_si",
  "section_ta",
  "question_label_en",
  "question_label_si",
  "question_label_ta",
  "option_value",
  "option_label_en",
  "option_label_si",
  "option_label_ta",
  "shown_if",
  "max_select",
  // ---- Join keys (added so analysts can VLOOKUP / merge straight against
  // the response CSV column headers without reconstructing the key shape) ----
  "column_key", // matches the response CSV question column header prefix, e.g. "survey1.q1"
  "label_column_key", // matches the response CSV sibling label column for choice/likert/yes_no, e.g. "survey1.q1.label_en" (else "")
  "join_key", // composite "{slug}|{question_id}|{option_value}" for option rows; "{slug}|{question_id}" otherwise
] as const;

/** Default (all-language) header list. Kept exported for back-compat. */
export const CODEBOOK_HEADERS = ALL_CODEBOOK_HEADERS;

export type CodebookRow = (string | "")[];

/** Header list scoped to the requested languages (always EN/SI/TA when undefined). */
export function buildCodebookHeaders(
  langs: readonly CodebookLang[] = CODEBOOK_LANGS,
): readonly string[] {
  const set = new Set(langs);
  return ALL_CODEBOOK_HEADERS.filter((h) => {
    const m = /_(en|si|ta)$/.exec(h);
    return !m || set.has(m[1] as CodebookLang);
  });
}

/**
 * Question types whose response-CSV column gets a sibling `*.label_en`
 * column. Mirrors the rule in `buildExportColumns` (label column iff
 * `q.options` is non-empty), so yes_no — which sources its options from
 * `YES_NO_OPTIONS` rather than `q.options` — is intentionally excluded.
 */
const HAS_LABEL_COL = new Set<Question["type"]>(["single_choice", "multi_choice", "likert_5"]);

/**
 * Build the full codebook row matrix in survey × question × option order.
 * Pass an explicit `slugs` array to scope the codebook to a subset of
 * surveys (used by `exportCodebookCsv` when a single survey is selected).
 * Unknown slugs are silently skipped. Pass `langs` to drop label columns
 * for languages the analyst does not need (defaults to EN+SI+TA).
 */
export function buildCodebookRows(
  slugs: readonly string[] = Object.keys(SURVEYS),
  langs: readonly CodebookLang[] = CODEBOOK_LANGS,
): {
  headers: readonly string[];
  rows: CodebookRow[];
  questionCount: number;
  optionCount: number;
  surveyCount: number;
} {
  const rows: CodebookRow[] = [];
  let questionCount = 0;
  let optionCount = 0;
  let surveyCount = 0;

  // Preserve canonical EN→SI→TA ordering even if the caller passes them out of order.
  const langSet = new Set(langs);
  const orderedLangs = CODEBOOK_LANGS.filter((l) => langSet.has(l));
  const pickLangs = (t: { en: string; si?: string; ta?: string } | undefined) =>
    orderedLangs.map((l) => pickText(t, l));

  for (const slug of slugs) {
    const survey = SURVEYS[slug];
    if (!survey) continue;
    surveyCount += 1;
    for (const q of survey.questions as Question[]) {
      if (q.type === "section_header") continue;
      questionCount += 1;
      const columnKey = `${survey.slug}.${q.id}`;
      const labelColumnKey = HAS_LABEL_COL.has(q.type) ? `${columnKey}.label_en` : "";
      const base: string[] = [
        survey.slug,
        ...pickLangs(survey.title),
        q.id,
        q.type,
        q.required ? "true" : "false",
        ...pickLangs(q.section),
        ...pickLangs(q.label),
      ];
      const tail: string[] = [
        q.showIf ? JSON.stringify(q.showIf) : "",
        q.maxSelect != null ? String(q.maxSelect) : "",
      ];

      const opts =
        q.type === "yes_no"
          ? (YES_NO_OPTIONS as unknown as Array<{
              value: string;
              label: { en: string; si?: string; ta?: string };
            }>)
          : (q.options ?? null);

      if (opts && opts.length > 0) {
        for (const opt of opts) {
          optionCount += 1;
          rows.push([
            ...base,
            opt.value,
            ...pickLangs(opt.label),
            ...tail,
            columnKey,
            labelColumnKey,
            `${survey.slug}|${q.id}|${opt.value}`,
          ]);
        }
      } else {
        rows.push([
          ...base,
          "",
          ...orderedLangs.map(() => ""),
          ...tail,
          columnKey,
          labelColumnKey,
          `${survey.slug}|${q.id}`,
        ]);
      }
    }
  }

  return {
    headers: buildCodebookHeaders(orderedLangs),
    rows,
    questionCount,
    optionCount,
    surveyCount,
  };
}
