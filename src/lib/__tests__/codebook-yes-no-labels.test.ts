/**
 * Export fidelity: every yes_no row emitted by `buildCodebookRows` must carry
 * the EN / SI / TA labels declared in the shared `YES_NO_OPTIONS` dictionary
 * (the same dictionary the SurveyRunner UI renders for yes_no questions).
 *
 * If anyone edits one side without the other — e.g. a translator updates the
 * Sinhala "Yes" label in `YES_NO_OPTIONS` but a stale copy still ends up in
 * the codebook — this test fails. It pins the codebook ↔ UI label contract
 * so analysts can join the export back to UI-rendered text without a manual
 * crosswalk.
 */
import { describe, expect, it } from "vitest";

import { buildCodebookRows, CODEBOOK_HEADERS } from "@/lib/csv-export-shape";
import { SURVEYS } from "@/surveys";
import { YES_NO_OPTIONS } from "@/surveys/types";
import { pickText } from "@/lib/i18n";

const COL = {
  survey_slug: CODEBOOK_HEADERS.indexOf("survey_slug"),
  question_id: CODEBOOK_HEADERS.indexOf("question_id"),
  question_type: CODEBOOK_HEADERS.indexOf("question_type"),
  option_value: CODEBOOK_HEADERS.indexOf("option_value"),
  option_label_en: CODEBOOK_HEADERS.indexOf("option_label_en"),
  option_label_si: CODEBOOK_HEADERS.indexOf("option_label_si"),
  option_label_ta: CODEBOOK_HEADERS.indexOf("option_label_ta"),
  label_column_key: CODEBOOK_HEADERS.indexOf("label_column_key"),
} as const;

describe("codebook yes/no labels match shared YES_NO_OPTIONS", () => {
  const { rows } = buildCodebookRows();
  const yesNoRows = rows.filter((r) => r[COL.question_type] === "yes_no");

  it("emits exactly two rows (yes + no) per yes_no question across all surveys", () => {
    let expectedYesNoQuestions = 0;
    for (const slug of Object.keys(SURVEYS)) {
      for (const q of SURVEYS[slug].questions) {
        if (q.type === "yes_no") expectedYesNoQuestions += 1;
      }
    }
    // sanity — fixture should actually exercise yes_no
    expect(expectedYesNoQuestions).toBeGreaterThan(0);
    expect(yesNoRows.length).toBe(expectedYesNoQuestions * YES_NO_OPTIONS.length);
  });

  it("each yes_no row's EN/SI/TA labels exactly equal YES_NO_OPTIONS", () => {
    const byValue = new Map(YES_NO_OPTIONS.map((o) => [o.value, o]));
    expect(byValue.size).toBe(YES_NO_OPTIONS.length);

    for (const row of yesNoRows) {
      const value = row[COL.option_value];
      const expected = byValue.get(value);
      expect(
        expected,
        `unexpected yes_no option value "${value}" in codebook (survey=${row[COL.survey_slug]} q=${row[COL.question_id]})`,
      ).toBeDefined();
      if (!expected) continue;

      expect(row[COL.option_label_en]).toBe(pickText(expected.label, "en"));
      expect(row[COL.option_label_si]).toBe(pickText(expected.label, "si"));
      expect(row[COL.option_label_ta]).toBe(pickText(expected.label, "ta"));
    }
  });

  it("yes_no rows leave label_column_key empty (no sibling .label_en column in responses CSV)", () => {
    // Mirrors the HAS_LABEL_COL rule in csv-export-shape.ts — yes_no sources
    // its options from YES_NO_OPTIONS, not q.options, so the responses CSV
    // does not emit a `<key>.label_en` column for yes_no.
    for (const row of yesNoRows) {
      expect(row[COL.label_column_key]).toBe("");
    }
  });

  it("covers every value in YES_NO_OPTIONS at least once", () => {
    const seen = new Set(yesNoRows.map((r) => r[COL.option_value]));
    for (const opt of YES_NO_OPTIONS) {
      expect(seen.has(opt.value)).toBe(true);
    }
  });
});
