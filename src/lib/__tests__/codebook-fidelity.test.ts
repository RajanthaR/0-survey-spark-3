import { describe, it, expect } from "vitest";

import {
  buildCodebookRows,
  buildCodebookHeaders,
  buildExportColumns,
  CODEBOOK_HEADERS,
  CODEBOOK_LANGS,
  type CodebookLang,
} from "@/lib/csv-export-shape";
import { SURVEYS } from "@/surveys";
import { pickText } from "@/lib/i18n";
import { YES_NO_OPTIONS, type Option, type Question } from "@/surveys/types";

/**
 * Fidelity tests: every codebook row must carry the exact multilingual
 * labels declared in the survey definitions, every required header must be
 * present in the canonical position, and the per-survey row counts must
 * equal Σ(options-or-1) over each non-section_header question.
 *
 * Where `csv-export-shape.test.ts` pins the *shape* (column counts,
 * ordering, lang filtering), this file pins the *semantics* — so a
 * mistranslated label or a dropped option in `src/surveys/**` is caught
 * even if the row still has the right arity.
 */

// ---- canonical column index map (tied to CODEBOOK_HEADERS) ----

function colIndex(header: string): number {
  const i = CODEBOOK_HEADERS.indexOf(header as (typeof CODEBOOK_HEADERS)[number]);
  if (i < 0) throw new Error(`unknown codebook column: ${header}`);
  return i;
}

const COL = {
  survey_slug: colIndex("survey_slug"),
  survey_title_en: colIndex("survey_title_en"),
  survey_title_si: colIndex("survey_title_si"),
  survey_title_ta: colIndex("survey_title_ta"),
  question_id: colIndex("question_id"),
  question_type: colIndex("question_type"),
  required: colIndex("required"),
  section_en: colIndex("section_en"),
  section_si: colIndex("section_si"),
  section_ta: colIndex("section_ta"),
  question_label_en: colIndex("question_label_en"),
  question_label_si: colIndex("question_label_si"),
  question_label_ta: colIndex("question_label_ta"),
  option_value: colIndex("option_value"),
  option_label_en: colIndex("option_label_en"),
  option_label_si: colIndex("option_label_si"),
  option_label_ta: colIndex("option_label_ta"),
  shown_if: colIndex("shown_if"),
  max_select: colIndex("max_select"),
  column_key: colIndex("column_key"),
  label_column_key: colIndex("label_column_key"),
  join_key: colIndex("join_key"),
} as const;

// Mirrors HAS_LABEL_COL in csv-export-shape.ts. yes_no is intentionally
// excluded — `buildExportColumns` only emits a sibling `*.label_en` column
// when `q.options` is non-empty, and yes_no sources its options from
// `YES_NO_OPTIONS` instead of `q.options`.
const HAS_LABEL_COL_TYPES = new Set(["single_choice", "multi_choice", "likert_5"]);

function optionsFor(q: Question): readonly Option[] {
  if (q.type === "yes_no") return YES_NO_OPTIONS;
  return q.options ?? [];
}

describe("codebook headers — canonical layout", () => {
  it("CODEBOOK_HEADERS contains all required columns in canonical order", () => {
    expect([...CODEBOOK_HEADERS]).toEqual([
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
      "column_key",
      "label_column_key",
      "join_key",
    ]);
  });

  it("buildCodebookHeaders defaults to the full canonical list", () => {
    expect([...buildCodebookHeaders()]).toEqual([...CODEBOOK_HEADERS]);
  });

  it("CODEBOOK_LANGS exposes exactly EN, SI, TA in that order", () => {
    expect([...CODEBOOK_LANGS]).toEqual(["en", "si", "ta"]);
  });
});

describe("codebook row counts — match survey definitions", () => {
  it("total row count = Σ over questions of max(options.length, 1)", () => {
    const { rows } = buildCodebookRows();
    let expected = 0;
    for (const slug of Object.keys(SURVEYS)) {
      for (const q of SURVEYS[slug].questions) {
        if (q.type === "section_header") continue;
        const opts = optionsFor(q);
        expected += opts.length > 0 ? opts.length : 1;
      }
    }
    expect(rows.length).toBe(expected);
  });

  it("per-survey row count equals that survey's Σ(options-or-1)", () => {
    for (const slug of Object.keys(SURVEYS)) {
      const { rows } = buildCodebookRows([slug]);
      let expected = 0;
      for (const q of SURVEYS[slug].questions) {
        if (q.type === "section_header") continue;
        const opts = optionsFor(q);
        expected += opts.length > 0 ? opts.length : 1;
      }
      expect(rows.length, `survey ${slug}`).toBe(expected);
    }
  });

  it("optionCount = Σ over questions of options.length (yes_no contributes 2)", () => {
    const { optionCount } = buildCodebookRows();
    let expected = 0;
    for (const slug of Object.keys(SURVEYS)) {
      for (const q of SURVEYS[slug].questions) {
        if (q.type === "section_header") continue;
        expected += optionsFor(q).length;
      }
    }
    expect(optionCount).toBe(expected);
  });

  it("questionCount = total non-section_header questions across all surveys", () => {
    const { questionCount } = buildCodebookRows();
    let expected = 0;
    for (const slug of Object.keys(SURVEYS)) {
      for (const q of SURVEYS[slug].questions) {
        if (q.type !== "section_header") expected += 1;
      }
    }
    expect(questionCount).toBe(expected);
  });
});

describe("codebook multilingual labels — match survey definitions exactly", () => {
  it("survey_title_{en|si|ta} on every row equals pickText(survey.title, lang)", () => {
    const { rows } = buildCodebookRows();
    for (const r of rows) {
      const slug = r[COL.survey_slug];
      const survey = SURVEYS[slug as string];
      expect(survey, `unknown survey slug ${slug}`).toBeDefined();
      expect(r[COL.survey_title_en]).toBe(pickText(survey.title, "en"));
      expect(r[COL.survey_title_si]).toBe(pickText(survey.title, "si"));
      expect(r[COL.survey_title_ta]).toBe(pickText(survey.title, "ta"));
    }
  });

  it("section_{en|si|ta} and question_label_{en|si|ta} match the question definition", () => {
    const { rows } = buildCodebookRows();
    for (const r of rows) {
      const slug = r[COL.survey_slug] as string;
      const qid = r[COL.question_id] as string;
      const q = SURVEYS[slug].questions.find((x) => x.id === qid)!;
      expect(q, `missing question ${slug}/${qid}`).toBeDefined();
      expect(r[COL.section_en]).toBe(pickText(q.section, "en"));
      expect(r[COL.section_si]).toBe(pickText(q.section, "si"));
      expect(r[COL.section_ta]).toBe(pickText(q.section, "ta"));
      expect(r[COL.question_label_en]).toBe(pickText(q.label, "en"));
      expect(r[COL.question_label_si]).toBe(pickText(q.label, "si"));
      expect(r[COL.question_label_ta]).toBe(pickText(q.label, "ta"));
      expect(r[COL.question_type]).toBe(q.type);
      expect(r[COL.required]).toBe(q.required ? "true" : "false");
    }
  });

  it("option_value and option_label_{en|si|ta} match the question's option list (in order)", () => {
    const { rows } = buildCodebookRows();
    // Group rows by (slug, qid) preserving emission order.
    const groups = new Map<string, (string | "")[][]>();
    for (const r of rows) {
      const k = `${r[COL.survey_slug]}::${r[COL.question_id]}`;
      const list = groups.get(k) ?? [];
      list.push(r);
      groups.set(k, list);
    }
    for (const [k, group] of groups) {
      const [slug, qid] = k.split("::");
      const q = SURVEYS[slug].questions.find((x) => x.id === qid)!;
      const opts = optionsFor(q);
      if (opts.length === 0) {
        expect(group.length, `no-options question ${k}`).toBe(1);
        const [r] = group;
        expect(r[COL.option_value]).toBe("");
        expect(r[COL.option_label_en]).toBe("");
        expect(r[COL.option_label_si]).toBe("");
        expect(r[COL.option_label_ta]).toBe("");
        continue;
      }
      expect(group.length, `option count for ${k}`).toBe(opts.length);
      for (let i = 0; i < opts.length; i++) {
        const r = group[i];
        const opt = opts[i];
        expect(r[COL.option_value], `${k}#${i} value`).toBe(opt.value);
        expect(r[COL.option_label_en], `${k}#${i} EN`).toBe(pickText(opt.label, "en"));
        expect(r[COL.option_label_si], `${k}#${i} SI`).toBe(pickText(opt.label, "si"));
        expect(r[COL.option_label_ta], `${k}#${i} TA`).toBe(pickText(opt.label, "ta"));
      }
    }
  });

  it("shown_if column carries the raw JSON of the visibility rule when present (else empty)", () => {
    const { rows } = buildCodebookRows();
    for (const r of rows) {
      const slug = r[COL.survey_slug] as string;
      const qid = r[COL.question_id] as string;
      const q = SURVEYS[slug].questions.find((x) => x.id === qid)!;
      expect(r[COL.shown_if]).toBe(q.showIf ? JSON.stringify(q.showIf) : "");
      expect(r[COL.max_select]).toBe(q.maxSelect != null ? String(q.maxSelect) : "");
    }
  });

  it("language filter narrows label columns to the requested language(s) without altering values", () => {
    for (const lang of CODEBOOK_LANGS) {
      const headers = buildCodebookHeaders([lang]);
      const { rows } = buildCodebookRows(undefined, [lang]);
      // Column index for the per-language labels in the trimmed header.
      const idx = (h: string) => headers.indexOf(h);
      const surveyTitle = idx(`survey_title_${lang}`);
      const sectionCol = idx(`section_${lang}`);
      const labelCol = idx(`question_label_${lang}`);
      const optionLabel = idx(`option_label_${lang}`);
      const slugCol = idx("survey_slug");
      const qidCol = idx("question_id");
      const valueCol = idx("option_value");
      expect(surveyTitle).toBeGreaterThanOrEqual(0);
      expect(sectionCol).toBeGreaterThanOrEqual(0);
      expect(labelCol).toBeGreaterThanOrEqual(0);
      expect(optionLabel).toBeGreaterThanOrEqual(0);

      for (const r of rows) {
        const slug = r[slugCol] as string;
        const qid = r[qidCol] as string;
        const survey = SURVEYS[slug];
        const q = survey.questions.find((x) => x.id === qid)!;
        expect(r[surveyTitle]).toBe(pickText(survey.title, lang as CodebookLang));
        expect(r[sectionCol]).toBe(pickText(q.section, lang as CodebookLang));
        expect(r[labelCol]).toBe(pickText(q.label, lang as CodebookLang));

        const value = r[valueCol] as string;
        if (value !== "") {
          const opts = optionsFor(q);
          const opt = opts.find((o) => o.value === value)!;
          expect(opt, `option ${slug}/${qid}/${value}`).toBeDefined();
          expect(r[optionLabel]).toBe(pickText(opt.label, lang as CodebookLang));
        }
      }
    }
  });
});

describe("codebook row arity and value invariants", () => {
  it("every cell is a string (no nullish leakage from pickText)", () => {
    const { rows } = buildCodebookRows();
    for (const r of rows) {
      for (const v of r) {
        expect(typeof v).toBe("string");
      }
    }
  });

  it("survey_slug column on every row matches a key in SURVEYS", () => {
    const knownSlugs = new Set(Object.keys(SURVEYS));
    const { rows } = buildCodebookRows();
    for (const r of rows) {
      expect(knownSlugs.has(r[COL.survey_slug] as string)).toBe(true);
    }
  });

  it("question_id column on every row corresponds to a real question in that survey", () => {
    const { rows } = buildCodebookRows();
    for (const r of rows) {
      const slug = r[COL.survey_slug] as string;
      const qid = r[COL.question_id] as string;
      const ids = new Set(SURVEYS[slug].questions.map((q) => q.id));
      expect(ids.has(qid), `${slug}/${qid}`).toBe(true);
    }
  });
});

describe("codebook join keys — match the response CSV column shape", () => {
  it("column_key equals `${slug}.${question_id}` on every row", () => {
    const { rows } = buildCodebookRows();
    for (const r of rows) {
      const slug = r[COL.survey_slug] as string;
      const qid = r[COL.question_id] as string;
      expect(r[COL.column_key]).toBe(`${slug}.${qid}`);
    }
  });

  it("label_column_key is `${column_key}.label_en` only for choice/likert/yes_no questions", () => {
    const { rows } = buildCodebookRows();
    for (const r of rows) {
      const slug = r[COL.survey_slug] as string;
      const qid = r[COL.question_id] as string;
      const q = SURVEYS[slug].questions.find((x) => x.id === qid)!;
      const expected = HAS_LABEL_COL_TYPES.has(q.type) ? `${slug}.${qid}.label_en` : "";
      expect(r[COL.label_column_key], `${slug}/${qid} (${q.type})`).toBe(expected);
    }
  });

  it("join_key is pipe-joined slug|qid|option_value (or slug|qid for non-option rows)", () => {
    const { rows } = buildCodebookRows();
    for (const r of rows) {
      const slug = r[COL.survey_slug] as string;
      const qid = r[COL.question_id] as string;
      const value = r[COL.option_value] as string;
      const expected = value !== "" ? `${slug}|${qid}|${value}` : `${slug}|${qid}`;
      expect(r[COL.join_key]).toBe(expected);
    }
  });

  it("join_key is unique per option row (no collisions across all surveys)", () => {
    const { rows } = buildCodebookRows();
    const seen = new Set<string>();
    for (const r of rows) {
      const k = r[COL.join_key] as string;
      expect(seen.has(k), `duplicate join_key ${k}`).toBe(false);
      seen.add(k);
    }
  });

  it("column_key on every codebook row matches a column header emitted by buildExportColumns()", () => {
    const validKeys = new Set(buildExportColumns().map((c) => c.key));
    const { rows } = buildCodebookRows();
    for (const r of rows) {
      expect(validKeys.has(r[COL.column_key] as string)).toBe(true);
    }
  });

  it("label_column_key (when set) matches a label column emitted by buildExportColumns()", () => {
    const validLabelKeys = new Set(
      buildExportColumns()
        .map((c) => c.labelKey)
        .filter((k): k is string => Boolean(k)),
    );
    const { rows } = buildCodebookRows();
    for (const r of rows) {
      const k = r[COL.label_column_key] as string;
      if (k !== "") expect(validLabelKeys.has(k)).toBe(true);
    }
  });

  it("join keys survive the language filter (column_key/label_column_key/join_key are language-agnostic)", () => {
    const full = buildCodebookRows();
    for (const lang of CODEBOOK_LANGS) {
      const trimmed = buildCodebookRows(undefined, [lang]);
      const headers = trimmed.headers;
      const ck = headers.indexOf("column_key");
      const lck = headers.indexOf("label_column_key");
      const jk = headers.indexOf("join_key");
      expect(ck).toBeGreaterThanOrEqual(0);
      expect(lck).toBeGreaterThanOrEqual(0);
      expect(jk).toBeGreaterThanOrEqual(0);
      expect(trimmed.rows.length).toBe(full.rows.length);
      for (let i = 0; i < trimmed.rows.length; i++) {
        expect(trimmed.rows[i][ck]).toBe(full.rows[i][COL.column_key]);
        expect(trimmed.rows[i][lck]).toBe(full.rows[i][COL.label_column_key]);
        expect(trimmed.rows[i][jk]).toBe(full.rows[i][COL.join_key]);
      }
    }
  });
});
