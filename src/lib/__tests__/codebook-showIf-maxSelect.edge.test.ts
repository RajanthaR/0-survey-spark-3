/**
 * Edge-case fidelity tests for the codebook's `shown_if` and `max_select`
 * columns. The contract under test:
 *
 *   1. `shown_if` is the **raw `JSON.stringify(q.showIf)`** when set, and
 *      the empty string otherwise — for both legacy (`{questionId, equals}`)
 *      and operator (`{questionId, op, value?}`) shapes.
 *   2. `max_select` is `String(q.maxSelect)` when set, and the empty string
 *      otherwise — including when the question is not a `multi_choice` (i.e.
 *      the field doesn't even apply).
 *   3. **Both columns are language-agnostic**: filtering the codebook to
 *      EN, SI, or TA must produce byte-identical `shown_if` / `max_select`
 *      cells. Same when the codebook is scoped to a single survey vs all.
 *   4. **Within a question, every option row carries the same `shown_if`
 *      and `max_select` cell** (these are question-level metadata, not
 *      per-option), so analysts joining on `option_value` never see drift.
 *   5. `shown_if` JSON survives a `JSON.parse` round-trip and matches the
 *      original `q.showIf` object — i.e. we never emit a stringified-twice
 *      value or stale snapshot.
 *
 * These complement `codebook-fidelity.test.ts`, which only pins the basic
 * "matches the question definition" relationship.
 */
import { describe, it, expect } from "vitest";

import { buildCodebookHeaders, buildCodebookRows, CODEBOOK_LANGS } from "@/lib/csv-export-shape";
import { SURVEYS } from "@/surveys";

function headerIdx(headers: readonly string[], h: string): number {
  const i = headers.indexOf(h);
  if (i < 0) throw new Error(`missing codebook header: ${h}`);
  return i;
}

describe("codebook shown_if / max_select — language-agnostic invariance", () => {
  it("shown_if and max_select cells are byte-identical across EN/SI/TA filters", () => {
    const fullHeaders = buildCodebookHeaders();
    const full = buildCodebookRows();
    const fullShown = headerIdx(fullHeaders, "shown_if");
    const fullMax = headerIdx(fullHeaders, "max_select");

    for (const lang of CODEBOOK_LANGS) {
      const headers = buildCodebookHeaders([lang]);
      const { rows } = buildCodebookRows(undefined, [lang]);
      const shownIdx = headerIdx(headers, "shown_if");
      const maxIdx = headerIdx(headers, "max_select");

      // Row count is preserved by language filtering — only label columns drop.
      expect(rows.length, `lang=${lang} row count`).toBe(full.rows.length);

      for (let i = 0; i < rows.length; i += 1) {
        expect(rows[i][shownIdx], `row ${i} shown_if @ ${lang}`).toBe(full.rows[i][fullShown]);
        expect(rows[i][maxIdx], `row ${i} max_select @ ${lang}`).toBe(full.rows[i][fullMax]);
      }
    }
  });

  it("single-survey scoping yields the same shown_if / max_select cells as the all-surveys codebook", () => {
    const fullHeaders = buildCodebookHeaders();
    const full = buildCodebookRows();
    const slugCol = headerIdx(fullHeaders, "survey_slug");
    const qidCol = headerIdx(fullHeaders, "question_id");
    const valueCol = headerIdx(fullHeaders, "option_value");
    const shownCol = headerIdx(fullHeaders, "shown_if");
    const maxCol = headerIdx(fullHeaders, "max_select");

    const fullByKey = new Map<string, { shown: string; max: string }>();
    for (const r of full.rows) {
      const key = `${r[slugCol]}|${r[qidCol]}|${r[valueCol]}`;
      fullByKey.set(key, {
        shown: String(r[shownCol]),
        max: String(r[maxCol]),
      });
    }

    for (const slug of Object.keys(SURVEYS)) {
      const scoped = buildCodebookRows([slug]);
      const sShown = headerIdx(scoped.headers, "shown_if");
      const sMax = headerIdx(scoped.headers, "max_select");
      for (const r of scoped.rows) {
        const key = `${r[slugCol]}|${r[qidCol]}|${r[valueCol]}`;
        const expected = fullByKey.get(key);
        expect(expected, `missing fixture for ${key}`).toBeDefined();
        expect(r[sShown], `${key} shown_if scoped vs full`).toBe(expected!.shown);
        expect(r[sMax], `${key} max_select scoped vs full`).toBe(expected!.max);
      }
    }
  });
});

describe("codebook shown_if / max_select — same value across every option row of a question", () => {
  it("all option rows of a single question carry identical shown_if and max_select cells", () => {
    const headers = buildCodebookHeaders();
    const { rows } = buildCodebookRows();
    const slugCol = headerIdx(headers, "survey_slug");
    const qidCol = headerIdx(headers, "question_id");
    const shownCol = headerIdx(headers, "shown_if");
    const maxCol = headerIdx(headers, "max_select");

    const groups = new Map<string, { shown: string; max: string; n: number }>();
    for (const r of rows) {
      const k = `${r[slugCol]}::${r[qidCol]}`;
      const shown = String(r[shownCol]);
      const max = String(r[maxCol]);
      const prev = groups.get(k);
      if (!prev) {
        groups.set(k, { shown, max, n: 1 });
        continue;
      }
      expect(shown, `shown_if drift across option rows of ${k}`).toBe(prev.shown);
      expect(max, `max_select drift across option rows of ${k}`).toBe(prev.max);
      groups.set(k, { ...prev, n: prev.n + 1 });
    }
    // Sanity: at least one question contributed multiple option rows so the
    // invariant is actually exercised, not vacuously true.
    expect([...groups.values()].some((g) => g.n > 1)).toBe(true);
  });
});

describe("codebook shown_if — value shape and JSON round-trip", () => {
  it("shown_if is empty for questions without a visibility rule", () => {
    const headers = buildCodebookHeaders();
    const { rows } = buildCodebookRows();
    const slugCol = headerIdx(headers, "survey_slug");
    const qidCol = headerIdx(headers, "question_id");
    const shownCol = headerIdx(headers, "shown_if");

    let checked = 0;
    for (const r of rows) {
      const slug = r[slugCol] as string;
      const qid = r[qidCol] as string;
      const q = SURVEYS[slug].questions.find((x) => x.id === qid)!;
      if (!q.showIf) {
        expect(r[shownCol], `${slug}/${qid} expected empty shown_if`).toBe("");
        checked += 1;
      }
    }
    expect(checked, "no rows without showIf were exercised").toBeGreaterThan(0);
  });

  it("non-empty shown_if cells JSON.parse back to the exact q.showIf object", () => {
    const headers = buildCodebookHeaders();
    const { rows } = buildCodebookRows();
    const slugCol = headerIdx(headers, "survey_slug");
    const qidCol = headerIdx(headers, "question_id");
    const shownCol = headerIdx(headers, "shown_if");

    let withRule = 0;
    for (const r of rows) {
      const cell = String(r[shownCol]);
      if (cell === "") continue;
      withRule += 1;
      const slug = r[slugCol] as string;
      const qid = r[qidCol] as string;
      const q = SURVEYS[slug].questions.find((x) => x.id === qid)!;
      expect(q.showIf, `${slug}/${qid} has shown_if but no q.showIf`).toBeDefined();
      // Round-trips to a deep-equal object…
      expect(JSON.parse(cell)).toEqual(q.showIf);
      // …and matches the canonical JSON.stringify of the source object.
      expect(cell).toBe(JSON.stringify(q.showIf));
    }
    expect(withRule, "no rows with showIf were exercised").toBeGreaterThan(0);
  });

  it("known phase-3 fixtures: legacy `equals: string` and array form serialize as expected", () => {
    const headers = buildCodebookHeaders();
    const { rows } = buildCodebookRows();
    const slugCol = headerIdx(headers, "survey_slug");
    const qidCol = headerIdx(headers, "question_id");
    const shownCol = headerIdx(headers, "shown_if");

    // p3_q5_months — legacy `{ questionId, equals: "high_some" }`
    const monthsRows = rows.filter((r) => r[slugCol] === "phase-3" && r[qidCol] === "p3_q5_months");
    expect(monthsRows.length).toBeGreaterThan(0);
    for (const r of monthsRows) {
      expect(r[shownCol]).toBe('{"questionId":"p3_q5_seasonal","equals":"high_some"}');
    }

    // p3_q19_exchanges_with — `{ questionId, equals: ["same","other"] }`
    const exRows = rows.filter(
      (r) => r[slugCol] === "phase-3" && r[qidCol] === "p3_q19_exchange_type",
    );
    expect(exRows.length).toBeGreaterThan(0);
    for (const r of exRows) {
      expect(r[shownCol]).toBe('{"questionId":"p3_q18_exchanges","equals":["same","other"]}');
    }
  });
});

describe("codebook max_select — null vs value rendering", () => {
  it("max_select is empty for every question with no maxSelect cap", () => {
    const headers = buildCodebookHeaders();
    const { rows } = buildCodebookRows();
    const slugCol = headerIdx(headers, "survey_slug");
    const qidCol = headerIdx(headers, "question_id");
    const maxCol = headerIdx(headers, "max_select");

    let checked = 0;
    for (const r of rows) {
      const slug = r[slugCol] as string;
      const qid = r[qidCol] as string;
      const q = SURVEYS[slug].questions.find((x) => x.id === qid)!;
      if (q.maxSelect == null) {
        expect(r[maxCol], `${slug}/${qid} expected empty max_select`).toBe("");
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("max_select for capped multi_choice questions equals String(q.maxSelect)", () => {
    const headers = buildCodebookHeaders();
    const { rows } = buildCodebookRows();
    const slugCol = headerIdx(headers, "survey_slug");
    const qidCol = headerIdx(headers, "question_id");
    const maxCol = headerIdx(headers, "max_select");

    let checked = 0;
    for (const r of rows) {
      const slug = r[slugCol] as string;
      const qid = r[qidCol] as string;
      const q = SURVEYS[slug].questions.find((x) => x.id === qid)!;
      if (q.maxSelect != null) {
        const cell = String(r[maxCol]);
        expect(cell, `${slug}/${qid} max_select`).toBe(String(q.maxSelect));
        // Decimal integer with no leading zero / sign / quoting.
        expect(cell).toMatch(/^[1-9]\d*$/);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("known phase-3 fixtures: p3_q12=3, p3_q16=2, p3_q28=3 in every language filter", () => {
    const expected: Record<string, string> = {
      p3_q12_re_barriers: "3",
      p3_q16_valorization: "2",
      p3_q28_enablers: "3",
    };
    for (const lang of CODEBOOK_LANGS) {
      const headers = buildCodebookHeaders([lang]);
      const { rows } = buildCodebookRows(undefined, [lang]);
      const slugCol = headerIdx(headers, "survey_slug");
      const qidCol = headerIdx(headers, "question_id");
      const maxCol = headerIdx(headers, "max_select");
      for (const [qid, want] of Object.entries(expected)) {
        const matches = rows.filter((r) => r[slugCol] === "phase-3" && r[qidCol] === qid);
        expect(matches.length, `${qid} @ ${lang}`).toBeGreaterThan(0);
        for (const r of matches) {
          expect(r[maxCol], `${qid} @ ${lang}`).toBe(want);
        }
      }
    }
  });
});
