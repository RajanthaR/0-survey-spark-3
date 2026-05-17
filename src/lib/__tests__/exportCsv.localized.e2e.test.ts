/**
 * E2E for the localized "Download CSV" admin export.
 *
 * Confirms that exporting collected survey responses through
 * `buildLocalizedResponsesCsv` produces a CSV whose:
 *   • column headers are the question labels in the requested language
 *     (English / Sinhala / Tamil)
 *   • single_choice / multi_choice / yes_no / likert_5 cells contain the
 *     localized option labels for the stored option `value`s — not the
 *     raw codes
 *   • free-text answers pass through unchanged
 *   • filename carries the language suffix
 *   • meta columns (id, status, language, …) keep stable English keys so the
 *     export is still machine-readable across locales
 */
import { describe, it, expect } from "vitest";
import {
  buildLocalizedResponsesCsv,
  RESPONSES_CSV_META_HEADERS,
  type ResponseRow,
} from "@/lib/responses-csv";
import type { Survey } from "@/surveys/types";
import { pickText } from "@/lib/i18n";

/** Minimal RFC-4180 row tokenizer (same as exportCsv.e2e.test.ts). */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"' && csv[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const SURVEY: Survey = {
  slug: "loc-export",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q_role",
      type: "single_choice",
      section: { en: "S", si: "S", ta: "S" },
      label: {
        en: "What is your role?",
        si: "ඔබේ භූමිකාව කුමක්ද?",
        ta: "உங்கள் பங்கு என்ன?",
      },
      options: [
        {
          value: "lead",
          label: { en: "Lead", si: "ප්‍රධානී", ta: "தலைவர்" },
        },
        {
          value: "member",
          label: { en: "Member", si: "සාමාජික", ta: "உறுப்பினர்" },
        },
      ],
      required: true,
    },
    {
      id: "q_docs",
      type: "multi_choice",
      section: { en: "S", si: "S", ta: "S" },
      label: {
        en: "Which documents can you share?",
        si: "ඔබට බෙදාගත හැකි ලේඛන මොනවාද?",
        ta: "எந்த ஆவணங்களைப் பகிர முடியும்?",
      },
      options: [
        {
          value: "annual",
          label: { en: "Annual reports", si: "වාර්ෂික වාර්තා", ta: "ஆண்டு அறிக்கைகள்" },
        },
        {
          value: "policy",
          label: { en: "Policy documents", si: "ප්‍රතිපත්ති ලේඛන", ta: "கொள்கை ஆவணங்கள்" },
        },
      ],
      required: false,
    },
    {
      id: "q_yes_no",
      type: "yes_no",
      section: { en: "S", si: "S", ta: "S" },
      label: {
        en: "Do you publish reports?",
        si: "ඔබ වාර්තා ප්‍රකාශ කරනවාද?",
        ta: "அறிக்கைகளை வெளியிடுகிறீர்களா?",
      },
      options: [
        { value: "yes", label: { en: "Yes", si: "ඔව්", ta: "ஆம்" } },
        { value: "no", label: { en: "No", si: "නැත", ta: "இல்லை" } },
      ],
      required: false,
    },
    {
      id: "q_comment",
      type: "long_text",
      section: { en: "S", si: "S", ta: "S" },
      label: {
        en: "Anything else?",
        si: "තවත් යමක්ද?",
        ta: "வேறு ஏதாவது?",
      },
      required: false,
    },
    // section_header rows must be skipped from the answer columns entirely.
    {
      id: "h1",
      type: "section_header",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "ignore me", si: "මඟ හරින්න", ta: "புறக்கணி" },
    },
  ],
};

const ROWS: ResponseRow[] = [
  {
    id: "resp-1",
    status: "completed",
    language: "en",
    progress_pct: 100,
    started_at: "2026-05-10T08:00:00.000Z",
    completed_at: "2026-05-10T08:15:00.000Z",
    contact: { name: "Asha", email: "asha@example.org", organization: "Org A" },
    answers: {
      q_role: "lead",
      q_docs: ["annual", "policy"],
      q_yes_no: "yes",
      q_comment: "Some, free-form\nnotes",
    },
  },
  {
    id: "resp-2",
    status: "in_progress",
    language: "si",
    progress_pct: 60,
    started_at: "2026-05-09T08:00:00.000Z",
    completed_at: null,
    contact: null,
    answers: {
      q_role: "member",
      q_docs: ["annual"],
      q_yes_no: "no",
      q_comment: "පිළිතුර",
    },
  },
];

describe("admin Download CSV — localized question + choice labels", () => {
  it.each(["en", "si", "ta"] as const)(
    "%s export uses localized headers, choice labels, and a language-tagged filename",
    (lang) => {
      const { csv, filename, rowCount } = buildLocalizedResponsesCsv(ROWS, SURVEY, lang);

      expect(rowCount).toBe(ROWS.length);
      expect(filename).toBe(`loc-export-responses-${lang}.csv`);

      const table = parseCsv(csv);
      expect(table).toHaveLength(1 + ROWS.length);

      // ── Header row ────────────────────────────────────────────────
      const header = table[0];
      // Meta columns stay in English keys for stable downstream tooling.
      expect(header.slice(0, RESPONSES_CSV_META_HEADERS.length)).toEqual(
        Array.from(RESPONSES_CSV_META_HEADERS),
      );
      // Question-label columns appear in survey-declared order, in `lang`,
      // and the section_header is omitted.
      const expectedQuestionHeaders = SURVEY.questions
        .filter((q) => q.type !== "section_header")
        .map((q) => pickText(q.label, lang));
      expect(header.slice(RESPONSES_CSV_META_HEADERS.length)).toEqual(expectedQuestionHeaders);
      expect(header).not.toContain(pickText(SURVEY.questions[4].label, lang));

      // ── Body rows: choice values are translated to localized labels ──
      const idIdx = header.indexOf("id");
      const roleIdx = header.indexOf(pickText(SURVEY.questions[0].label, lang));
      const docsIdx = header.indexOf(pickText(SURVEY.questions[1].label, lang));
      const ynIdx = header.indexOf(pickText(SURVEY.questions[2].label, lang));
      const commentIdx = header.indexOf(pickText(SURVEY.questions[3].label, lang));

      const r1 = table.find((r) => r[idIdx] === "resp-1")!;
      const r2 = table.find((r) => r[idIdx] === "resp-2")!;
      expect(r1).toBeTruthy();
      expect(r2).toBeTruthy();

      // single_choice → localized label
      expect(r1[roleIdx]).toBe(
        pickText(SURVEY.questions[0].options![0].label, lang), // "lead"
      );
      expect(r2[roleIdx]).toBe(
        pickText(SURVEY.questions[0].options![1].label, lang), // "member"
      );

      // multi_choice → "; "-joined localized labels, in submitted order
      const docsOpts = SURVEY.questions[1].options!;
      expect(r1[docsIdx]).toBe(
        [
          pickText(docsOpts[0].label, lang), // annual
          pickText(docsOpts[1].label, lang), // policy
        ].join("; "),
      );
      expect(r2[docsIdx]).toBe(pickText(docsOpts[0].label, lang));

      // yes_no → localized "Yes"/"No"
      const ynOpts = SURVEY.questions[2].options!;
      expect(r1[ynIdx]).toBe(pickText(ynOpts[0].label, lang)); // yes
      expect(r2[ynIdx]).toBe(pickText(ynOpts[1].label, lang)); // no

      // free-text passes through verbatim (including the comma + newline,
      // which the RFC-4180 escaping must round-trip)
      expect(r1[commentIdx]).toBe("Some, free-form\nnotes");
      expect(r2[commentIdx]).toBe("පිළිතුර");

      // The recorded `language` meta column reflects the row's storage
      // language, independent of the export language.
      const langIdx = header.indexOf("language");
      expect(r1[langIdx]).toBe("en");
      expect(r2[langIdx]).toBe("si");
    },
  );

  it("the three localized exports differ for the same input rows (no EN fallback)", () => {
    const en = buildLocalizedResponsesCsv(ROWS, SURVEY, "en").csv;
    const si = buildLocalizedResponsesCsv(ROWS, SURVEY, "si").csv;
    const ta = buildLocalizedResponsesCsv(ROWS, SURVEY, "ta").csv;
    expect(new Set([en, si, ta]).size).toBe(3);
    // Each export must contain at least one script-distinct token from its
    // language so we know the localization actually fired.
    expect(si).toContain("ප්‍රධානී"); // SI label for "lead"
    expect(ta).toContain("தலைவர்"); // TA label for "lead"
    expect(en).toContain("Lead");
  });

  it("unknown option values fall back to the raw code (defensive)", () => {
    const { csv } = buildLocalizedResponsesCsv(
      [
        {
          id: "resp-x",
          status: "completed",
          language: "en",
          progress_pct: 100,
          started_at: "2026-05-10T08:00:00.000Z",
          answers: { q_role: "ghost-value", q_docs: ["mystery"] },
        },
      ],
      SURVEY,
      "en",
    );
    const [, body] = parseCsv(csv);
    const header = parseCsv(csv)[0];
    expect(body[header.indexOf("What is your role?")]).toBe("ghost-value");
    expect(body[header.indexOf("Which documents can you share?")]).toBe("mystery");
  });
});
