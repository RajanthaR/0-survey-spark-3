import { describe, it, expect } from "vitest";

import {
  buildExportColumns,
  buildExportHeaderRow,
  buildCodebookRows,
  META_HEADERS,
  CODEBOOK_HEADERS,
} from "@/lib/csv-export-shape";
import { SURVEYS } from "@/surveys";
import type { Question } from "@/surveys/types";

/**
 * These tests pin the *shape* of the admin CSV exports so accidental
 * reorderings, language-dependent headers, or dropped questions get caught
 * in CI. The full ordered header lists are snapshotted so a deliberate
 * survey edit shows up as a one-line snapshot diff that's easy to review.
 */

const ALL_QUESTIONS: { slug: string; q: Question }[] = [];
for (const slug of Object.keys(SURVEYS)) {
  for (const q of SURVEYS[slug].questions) {
    if (q.type === "section_header") continue;
    ALL_QUESTIONS.push({ slug, q });
  }
}

const HAS_LABELS = (q: Question) =>
  q.type === "single_choice" ||
  q.type === "multi_choice" ||
  q.type === "likert_5";

describe("buildExportColumns / all-valid CSV shape", () => {
  it("emits one column per non-section_header question, in survey × question order", () => {
    const cols = buildExportColumns();
    expect(cols.map((c) => c.key)).toEqual(
      ALL_QUESTIONS.map(({ slug, q }) => `${slug}.${q.id}`),
    );
  });

  it("attaches a sibling label_en column for choice/likert question types", () => {
    const cols = buildExportColumns();
    for (const c of cols) {
      const q = ALL_QUESTIONS.find((x) => x.slug === c.slug && x.q.id === c.qid)!.q;
      if (HAS_LABELS(q)) {
        expect(c.labelKey, `expected label column for ${c.key} (${q.type})`).toBe(
          `${c.key}.label_en`,
        );
        expect(c.labelHeader).toMatch(/^.*\.label_en \| English label/);
      }
    }
  });

  it("never carries section_header questions into the column list", () => {
    const cols = buildExportColumns();
    expect(cols.every((c) => c.kind !== "section_header")).toBe(true);
  });

  it("respects the survey-scope argument (filtered export narrowing)", () => {
    const firstSlug = Object.keys(SURVEYS)[0]!;
    const cols = buildExportColumns([firstSlug]);
    expect(cols.length).toBeGreaterThan(0);
    expect(cols.every((c) => c.slug === firstSlug)).toBe(true);
  });

  it("ignores unknown slugs without throwing", () => {
    expect(buildExportColumns(["__does_not_exist__"])).toEqual([]);
  });
});

describe("buildExportHeaderRow — language-invariant header strings", () => {
  const cols = buildExportColumns();
  const headerRow = buildExportHeaderRow(cols);

  it("starts with META_HEADERS in their canonical order", () => {
    expect(headerRow.slice(0, META_HEADERS.length)).toEqual([...META_HEADERS]);
  });

  it("embeds EN, SI, and TA labels in every question header (no language drift)", () => {
    for (const c of cols) {
      expect(c.header, `EN label missing in ${c.key}`).toMatch(/\| EN: /);
      expect(c.header, `SI label missing in ${c.key}`).toMatch(/\| SI: /);
      expect(c.header, `TA label missing in ${c.key}`).toMatch(/\| TA: /);
      expect(c.header, `section EN missing in ${c.key}`).toMatch(/\| section EN: /);
      // section SI/TA reuse the same `| SI: ` / `| TA: ` separators as the question label;
      // the question label EN/SI/TA come after, so each separator must appear at least twice.
      expect((c.header.match(/\| SI: /g) ?? []).length).toBeGreaterThanOrEqual(2);
      expect((c.header.match(/\| TA: /g) ?? []).length).toBeGreaterThanOrEqual(2);
      expect(c.header.startsWith(`${c.key} [${c.kind}]`)).toBe(true);
    }
  });

  it("keeps the full ordered header row stable (snapshot)", () => {
    expect(headerRow).toMatchSnapshot();
  });
});

describe("buildCodebookRows — codebook CSV shape", () => {
  it("uses the canonical codebook header list", () => {
    const { headers } = buildCodebookRows();
    expect([...headers]).toEqual([...CODEBOOK_HEADERS]);
  });

  it("counts question rows correctly (one row per non-section_header question)", () => {
    const { questionCount } = buildCodebookRows();
    expect(questionCount).toBe(ALL_QUESTIONS.length);
  });

  it("surveyCount matches SURVEYS keys", () => {
    const { surveyCount } = buildCodebookRows();
    expect(surveyCount).toBe(Object.keys(SURVEYS).length);
  });

  it("emits one row per option for choice/likert/yes_no, one row otherwise", () => {
    const { rows } = buildCodebookRows();
    let expected = 0;
    for (const { q } of ALL_QUESTIONS) {
      if (q.type === "yes_no") expected += 2;
      else if (q.options && q.options.length > 0) expected += q.options.length;
      else expected += 1;
    }
    expect(rows.length).toBe(expected);
  });

  it("keeps every codebook row at the canonical header arity", () => {
    const { headers, rows } = buildCodebookRows();
    for (const r of rows) expect(r.length).toBe(headers.length);
  });

  it("keeps the survey × question × option ordering stable (snapshot of keys)", () => {
    const { rows } = buildCodebookRows();
    // survey_slug, question_id, option_value are columns 0, 4, 13
    const fingerprint = rows.map((r) => `${r[0]}|${r[4]}|${r[13]}`);
    expect(fingerprint).toMatchSnapshot();
  });

  it("scopes to a single survey when slugs is provided", () => {
    const firstSlug = Object.keys(SURVEYS)[0];
    const { rows, surveyCount, questionCount } = buildCodebookRows([firstSlug]);
    expect(surveyCount).toBe(1);
    for (const r of rows) expect(r[0]).toBe(firstSlug);
    const expectedQs = SURVEYS[firstSlug].questions.filter(
      (q) => q.type !== "section_header",
    ).length;
    expect(questionCount).toBe(expectedQs);
  });

  it("ignores unknown slugs and produces an empty codebook", () => {
    const { rows, surveyCount, questionCount, optionCount } = buildCodebookRows([
      "__not_a_real_survey__",
    ]);
    expect(rows).toEqual([]);
    expect(surveyCount).toBe(0);
    expect(questionCount).toBe(0);
    expect(optionCount).toBe(0);
  });

  it("scoped + full codebook row counts add up to the all-surveys total", () => {
    const slugs = Object.keys(SURVEYS);
    const full = buildCodebookRows();
    const summed = slugs.reduce(
      (n, s) => n + buildCodebookRows([s]).rows.length,
      0,
    );
    expect(summed).toBe(full.rows.length);
  });

  it("language filter drops the other languages' label columns", () => {
    const ALL = ["en", "si", "ta"] as const;
    for (const lang of ALL) {
      const { headers, rows } = buildCodebookRows(undefined, [lang]);
      // Headers: only the requested-language columns survive.
      for (const other of ALL) {
        if (other === lang) continue;
        expect(headers.some((h) => h.endsWith(`_${other}`))).toBe(false);
      }
      expect(headers.some((h) => h.endsWith(`_${lang}`))).toBe(true);
      // Every row matches the trimmed header arity.
      for (const r of rows) expect(r.length).toBe(headers.length);
    }
  });

  it("preserves canonical EN→SI→TA header ordering even if langs is reordered", () => {
    const reordered = buildCodebookRows(undefined, ["ta", "en", "si"]);
    const full = buildCodebookRows();
    expect([...reordered.headers]).toEqual([...full.headers]);
    expect(reordered.rows.length).toBe(full.rows.length);
  });

  it("row counts and survey/question/option counts are unchanged by lang filter", () => {
    const full = buildCodebookRows();
    const en = buildCodebookRows(undefined, ["en"]);
    expect(en.rows.length).toBe(full.rows.length);
    expect(en.questionCount).toBe(full.questionCount);
    expect(en.optionCount).toBe(full.optionCount);
    expect(en.surveyCount).toBe(full.surveyCount);
  });
});
