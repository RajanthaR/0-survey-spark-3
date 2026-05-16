/**
 * Pure-builder coverage for the three new export shapes shipped alongside
 * `responses-csv.ts`:
 *   • sectioned localized CSV (per-section column prefix)
 *   • localized XLSX AOA (header + data rows pre-encoding)
 *   • per-response validation report (missing required + invalid choice codes)
 *
 * Server fns in `admin.functions.ts` are thin wrappers around these — they
 * only own the auth check, the paginated fetch, and the XLSX `.write()`
 * call — so verifying the row shape here is enough to lock the contract.
 */
import { describe, expect, it } from "vitest";
import type { Survey } from "@/surveys/types";
import type { ResponseRow } from "@/lib/responses-csv";
import {
  buildSectionedLocalizedResponsesCsv,
  buildLocalizedResponsesXlsxAoa,
  buildValidationReportCsv,
} from "@/lib/exports-extended";

const SURVEY: Survey = {
  slug: "demo",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "sec_a",
      type: "section_header",
      section: { en: "Sec A", si: "කොටස A", ta: "பகுதி A" },
      label: { en: "Section A", si: "කොටස A", ta: "பகுதி A" },
    },
    {
      id: "q_role",
      type: "single_choice",
      section: { en: "Sec A", si: "කොටස A", ta: "பகுதி A" },
      label: { en: "Role", si: "භූමිකාව", ta: "பங்கு" },
      required: true,
      options: [
        { value: "lead", label: { en: "Lead", si: "ප්‍රධාන", ta: "முதன்மை" } },
        { value: "staff", label: { en: "Staff", si: "කාර්ය", ta: "ஊழியர்" } },
      ],
    },
    {
      id: "q_notes",
      type: "long_text",
      section: { en: "Sec B", si: "කොටස B", ta: "பகுதி B" },
      label: { en: "Notes", si: "සටහන්", ta: "குறிப்புகள்" },
      required: false,
    },
  ],
};

const ROWS: ResponseRow[] = [
  {
    id: "r-good",
    status: "completed",
    language: "si",
    progress_pct: 100,
    started_at: "2026-05-15T10:00:00Z",
    completed_at: "2026-05-15T10:05:00Z",
    contact: { name: "Asha", email: "a@x.lk", organization: "Org" },
    answers: { q_role: "lead", q_notes: "ok" },
  },
  {
    id: "r-bad",
    status: "completed",
    language: "ta",
    progress_pct: 100,
    started_at: "2026-05-15T11:00:00Z",
    completed_at: null,
    contact: null,
    answers: { q_role: "ghost-code", q_notes: "" }, // invalid choice + missing required satisfied
  },
];

describe("buildSectionedLocalizedResponsesCsv", () => {
  it("prefixes each question header with its localized section name", () => {
    const out = buildSectionedLocalizedResponsesCsv(ROWS, SURVEY, "si");
    const [header] = out.csv.split("\n");
    expect(header).toContain("[කොටස A] භූමිකාව");
    expect(header).toContain("[කොටස B] සටහන්");
    expect(out.filename).toBe("demo-responses-sectioned-si.csv");
    expect(out.rowCount).toBe(2);
  });

  it("keeps the meta column block stable as the leading 9 columns", () => {
    const out = buildSectionedLocalizedResponsesCsv(ROWS, SURVEY, "en");
    const cols = out.csv.split("\n")[0].split(",");
    expect(cols.slice(0, 9)).toEqual([
      "id",
      "status",
      "language",
      "progress_pct",
      "started_at",
      "completed_at",
      "contact_name",
      "contact_email",
      "contact_org",
    ]);
  });
});

describe("buildLocalizedResponsesXlsxAoa", () => {
  it("returns header + one row per response with localized choice labels", () => {
    const out = buildLocalizedResponsesXlsxAoa(ROWS, SURVEY, "ta");
    expect(out.aoa).toHaveLength(3); // header + 2 rows
    expect(out.aoa[0]).toContain("பங்கு"); // localized question label
    // r-good's q_role=lead → ta label "முதன்மை"
    const rGoodRow = out.aoa[1];
    expect(rGoodRow).toContain("முதன்மை");
    expect(out.filename).toBe("demo-responses-ta.xlsx");
  });
});

describe("buildValidationReportCsv", () => {
  it("flags invalid choice codes and counts only the failing rows", () => {
    const out = buildValidationReportCsv(ROWS, SURVEY, "en");
    expect(out.invalidCount).toBe(1);
    expect(out.filename).toBe("demo-validation-report-en.csv");

    const lines = out.csv.split("\n");
    const header = lines[0].split(",");
    expect(header).toContain("is_valid");
    expect(header).toContain("missing_required");
    expect(header).toContain("invalid_choice_codes");

    // r-good is valid; r-bad has q_role=ghost-code which isn't in the option set.
    expect(lines[1]).toContain("true");
    expect(lines[2]).toContain("false");
    expect(lines[2]).toContain("q_role=ghost-code");
  });

  it("reports missing required questions when the answer is empty", () => {
    const rows: ResponseRow[] = [
      {
        id: "r-missing",
        status: "completed",
        language: "en",
        progress_pct: 50,
        started_at: "2026-05-15T12:00:00Z",
        completed_at: null,
        contact: null,
        answers: {}, // q_role is required and unanswered
      },
    ];
    const out = buildValidationReportCsv(rows, SURVEY, "en");
    expect(out.invalidCount).toBe(1);
    expect(out.csv.split("\n")[1]).toContain("q_role");
  });
});
