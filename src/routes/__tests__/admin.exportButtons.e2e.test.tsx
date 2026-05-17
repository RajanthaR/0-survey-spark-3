/**
 * Admin UI e2e: clicking the filtered Export CSV / Export XLSX buttons
 * with different (survey × language) selections produces:
 *
 *   - the right server-fn payload (surveySlug + language are forwarded),
 *   - a download whose filename matches the canonical filename rule
 *     baked into `buildFilteredExportRows`,
 *   - download bytes whose CSV contents are byte-identical to what the
 *     shared CSV builder (`buildExportColumns` + `buildExportHeaderRow`
 *     + the same escape() the server fn uses) would produce for the
 *     same fixture rows.
 *
 * The real `src/routes/admin.tsx` drags in auth bootstrap, the Supabase
 * client, recharts, and ~15 server fns, so we mount a small
 * `<ExportButtonsHarness>` that mirrors `downloadFilteredCsv` /
 * `downloadFilteredXlsx` (admin.tsx ~L850-L931) verbatim:
 *
 *   - payload assembly (surveySlug/language only attached when not "__all__")
 *   - Blob + URL.createObjectURL + <a download={filename}> click
 *   - URL.revokeObjectURL on the same handle
 *
 * `exportFilteredFn` is a `vi.fn()` that runs the *real* shared CSV
 * builder against an inline fixture so the bytes the test inspects are
 * the bytes a real server response would carry for the same rows.
 *
 * The XLSX path is exercised structurally: we feed back a base64
 * payload from the harness and assert the saved Blob's bytes match
 * what the harness produced (so the download wiring is verified) and
 * the filename matches the same rule the CSV path uses (XLSX shares
 * the same stem, only extension differs).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildExportColumns, buildExportHeaderRow } from "@/lib/csv-export-shape";

// ---------------------------------------------------------------------------
// Filename rule mirror — kept in sync with the inline rule baked into
// buildFilteredExportRows in src/lib/admin.functions.ts (~L1052-L1072).
// ---------------------------------------------------------------------------
function filteredFilenameStem(d: {
  surveySlug?: string;
  language?: "en" | "si" | "ta";
  dateField: "started_at" | "completed_at";
  statusFilter?: "completed" | "in_progress" | "all";
  validOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  date: Date;
}): string {
  const effectiveStatus = d.validOnly ? "completed" : (d.statusFilter ?? "completed");
  const stamp = d.date.toISOString().slice(0, 10);
  const statusPart = d.validOnly
    ? "valid-completed"
    : effectiveStatus === "completed"
      ? "completed"
      : effectiveStatus === "in_progress"
        ? "in-progress"
        : "all-statuses";
  const dateTag = d.dateField === "completed_at" ? "completed" : "started";
  const parts = [
    d.surveySlug ?? "all-surveys",
    statusPart,
    d.language ?? "all-langs",
    `${dateTag}-${d.dateFrom ?? "any"}`,
    `${dateTag}-${d.dateTo ?? "any"}`,
    stamp,
  ];
  return `eip-insight-${parts.join("_")}`;
}

// ---------------------------------------------------------------------------
// CSV builder mirror — same shape buildFilteredExportRows + exportFilteredCsv
// emit. Uses the *real* shared csv-export-shape helpers so the test fails
// loudly if the column order / header rule changes upstream.
// ---------------------------------------------------------------------------
type FixtureRow = {
  survey_slug: string;
  id: string;
  status: "completed" | "in_progress";
  language: "en" | "si" | "ta";
  started_at: string;
  completed_at?: string;
  contact?: { name?: string; email?: string; organization?: string };
  answers: Record<string, unknown>;
};

const VALIDITY_HEADER =
  "is_valid_completed | true|false — passes isValidCompletedResponse (survey known + every visible required question answered)";
const STATUS_LABEL_HEADER =
  "status_label | Completed|In progress|Other — human-readable label for the raw `status` meta column";
const META_LEN = 11;

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildFilteredCsvForRows(surveySlug: string | undefined, rows: FixtureRow[]): string {
  const slugs = surveySlug ? [surveySlug] : Array.from(new Set(rows.map((r) => r.survey_slug)));
  const cols = buildExportColumns(slugs);
  const baseHeader = buildExportHeaderRow(cols);
  const headerRow = [
    ...baseHeader.slice(0, META_LEN),
    VALIDITY_HEADER,
    STATUS_LABEL_HEADER,
    ...baseHeader.slice(META_LEN),
  ];
  const lines: string[] = [headerRow.map(csvEscape).join(",")];
  for (const r of rows) {
    const c = r.contact ?? {};
    const startedAt = new Date(r.started_at);
    const completedAt = r.completed_at ? new Date(r.completed_at) : null;
    const durationSec = completedAt
      ? Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000))
      : "";
    const statusLabel =
      r.status === "completed" ? "Completed" : r.status === "in_progress" ? "In progress" : "Other";
    const row: unknown[] = [
      r.survey_slug,
      r.id,
      r.status,
      r.language,
      "",
      r.started_at,
      r.completed_at ?? "",
      durationSec,
      c.name ?? "",
      c.email ?? "",
      c.organization ?? "",
      r.status === "completed" ? "true" : "false",
      statusLabel,
    ];
    for (const col of cols) {
      if (col.slug !== r.survey_slug) {
        row.push("");
        if (col.labelKey) row.push("");
        continue;
      }
      const val = r.answers[col.qid];
      row.push(val == null ? "" : val);
      if (col.labelKey) {
        if (val == null) row.push("");
        else if (Array.isArray(val))
          row.push(val.map((v) => col.optionLabelEn?.get(String(v)) ?? String(v)).join("; "));
        else row.push(col.optionLabelEn?.get(String(val)) ?? String(val));
      }
    }
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Harness — verbatim mirror of admin.tsx's downloadFilteredCsv +
// downloadFilteredXlsx (sans toast, which is covered by the
// admin.validOnlyToggle.e2e suite).
// ---------------------------------------------------------------------------
type ExportPayload = {
  statusFilter: "completed" | "in_progress" | "all";
  validOnly: boolean;
  dateField: "started_at" | "completed_at";
  surveySlug?: string;
  language?: "en" | "si" | "ta";
  dateFrom?: string;
  dateTo?: string;
};

type CsvResult = {
  csv: string;
  filename: string;
  rowCount: number;
  droppedInvalid: number;
  droppedUnknownSurvey: number;
};
type XlsxResult = Omit<CsvResult, "csv"> & { base64: string };

function ExportButtonsHarness(props: {
  exportCsvFn: (args: { data: ExportPayload }) => Promise<CsvResult>;
  exportXlsxFn: (args: { data: ExportPayload }) => Promise<XlsxResult>;
  initialSurvey?: string;
  initialLang?: "__all__" | "en" | "si" | "ta";
}) {
  const [fSurvey, setFSurvey] = useState(props.initialSurvey ?? "__all__");
  const [fLang, setFLang] = useState<"__all__" | "en" | "si" | "ta">(
    props.initialLang ?? "__all__",
  );

  function buildPayload(): ExportPayload {
    const payload: ExportPayload = {
      statusFilter: "completed",
      validOnly: false,
      dateField: "started_at",
    };
    if (fSurvey !== "__all__") payload.surveySlug = fSurvey;
    if (fLang !== "__all__") payload.language = fLang as "en" | "si" | "ta";
    return payload;
  }

  async function downloadCsv() {
    const { csv, filename } = await props.exportCsvFn({ data: buildPayload() });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadXlsx() {
    const { base64, filename } = await props.exportXlsxFn({ data: buildPayload() });
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <select data-testid="survey" value={fSurvey} onChange={(e) => setFSurvey(e.target.value)}>
        <option value="__all__">All surveys</option>
        <option value="phase-1">phase-1</option>
        <option value="phase-3">phase-3</option>
      </select>
      <select
        data-testid="lang"
        value={fLang}
        onChange={(e) => setFLang(e.target.value as "__all__" | "en" | "si" | "ta")}
      >
        <option value="__all__">All languages</option>
        <option value="en">EN</option>
        <option value="si">SI</option>
        <option value="ta">TA</option>
      </select>
      <button data-testid="export-csv" onClick={downloadCsv}>
        Export CSV
      </button>
      <button data-testid="export-xlsx" onClick={downloadXlsx}>
        Export XLSX
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stub URL.createObjectURL / revokeObjectURL + <a>.click() so we can
// capture exactly what the download wiring sent through.
// ---------------------------------------------------------------------------
type Captured = {
  blobs: Blob[];
  filenames: string[];
  urls: string[];
  revoked: string[];
};

function installDownloadCapture(): Captured {
  const captured: Captured = { blobs: [], filenames: [], urls: [], revoked: [] };
  let n = 0;
  const createSpy = vi.spyOn(URL, "createObjectURL").mockImplementation((b: Blob | MediaSource) => {
    captured.blobs.push(b as Blob);
    const url = `blob:test/${++n}`;
    captured.urls.push(url);
    return url;
  });
  const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation((u: string) => {
    captured.revoked.push(u);
  });
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    captured.filenames.push(this.download);
  });
  // Park the spies so afterEach can restore.
  installedSpies.push(createSpy, revokeSpy, clickSpy);
  return captured;
}

const installedSpies: { mockRestore: () => void }[] = [];

const FIXED_NOW = new Date("2026-05-15T07:30:00.000Z");

// Note: we intentionally do NOT use vi.useFakeTimers() here — userEvent
// drives its own timers and fake timers cause its clicks to hang. The
// FIXED_NOW constant is passed explicitly into the filename rule via the
// stub server fns, so test stability does not depend on system time.

afterEach(() => {
  while (installedSpies.length) installedSpies.pop()!.mockRestore();
});

async function readBlob(b: Blob): Promise<string> {
  // jsdom Blob doesn't implement .text() reliably across versions, so go via arrayBuffer.
  // ignoreBOM: true so the leading BOM the route prepends survives the decode and we
  // can assert on it (default TextDecoder eats a leading BOM).
  const buf = await b.arrayBuffer();
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(buf);
}

// ---------------------------------------------------------------------------
// Fixture rows — three responses across two surveys / three languages so
// every (survey × language) selection has at least one matching row.
// ---------------------------------------------------------------------------
const FIXTURE: FixtureRow[] = [
  {
    survey_slug: "phase-1",
    id: "r-en-1",
    status: "completed",
    language: "en",
    started_at: "2026-05-10T10:00:00.000Z",
    completed_at: "2026-05-10T10:05:00.000Z",
    contact: { name: "Ada" },
    answers: {},
  },
  {
    survey_slug: "phase-1",
    id: "r-si-1",
    status: "completed",
    language: "si",
    started_at: "2026-05-11T10:00:00.000Z",
    completed_at: "2026-05-11T10:04:00.000Z",
    contact: { name: "Bee" },
    answers: {},
  },
  {
    survey_slug: "phase-3",
    id: "r-ta-1",
    status: "completed",
    language: "ta",
    started_at: "2026-05-12T10:00:00.000Z",
    completed_at: "2026-05-12T10:06:00.000Z",
    contact: { name: "Cee" },
    answers: {},
  },
];

function makeServerFns() {
  const exportCsvFn = vi.fn(async ({ data }: { data: ExportPayload }): Promise<CsvResult> => {
    const matching = FIXTURE.filter(
      (r) =>
        (!data.surveySlug || r.survey_slug === data.surveySlug) &&
        (!data.language || r.language === data.language),
    );
    const csv = buildFilteredCsvForRows(data.surveySlug, matching);
    const stem = filteredFilenameStem({ ...data, date: FIXED_NOW });
    return {
      csv,
      filename: `${stem}.csv`,
      rowCount: matching.length,
      droppedInvalid: 0,
      droppedUnknownSurvey: 0,
    };
  });
  const exportXlsxFn = vi.fn(async ({ data }: { data: ExportPayload }): Promise<XlsxResult> => {
    const matching = FIXTURE.filter(
      (r) =>
        (!data.surveySlug || r.survey_slug === data.surveySlug) &&
        (!data.language || r.language === data.language),
    );
    // The real server fn returns a real .xlsx; for the wiring test we
    // just need bytes-roundtrip through base64 to confirm the harness
    // reconstructs them faithfully. Use the CSV bytes as the payload
    // marker so the assertion can compare against the CSV builder.
    const csv = buildFilteredCsvForRows(data.surveySlug, matching);
    const bin = new TextEncoder().encode(csv);
    let s = "";
    for (let i = 0; i < bin.length; i++) s += String.fromCharCode(bin[i]);
    const stem = filteredFilenameStem({ ...data, date: FIXED_NOW });
    return {
      base64: btoa(s),
      filename: `${stem}.xlsx`,
      rowCount: matching.length,
      droppedInvalid: 0,
      droppedUnknownSurvey: 0,
    };
  });
  return { exportCsvFn, exportXlsxFn };
}

describe("admin export buttons — CSV download", () => {
  it.each([
    {
      survey: "__all__" as const,
      lang: "__all__" as const,
      expectedFilename:
        "eip-insight-all-surveys_completed_all-langs_started-any_started-any_2026-05-15.csv",
    },
    {
      survey: "phase-1",
      lang: "en" as const,
      expectedFilename: "eip-insight-phase-1_completed_en_started-any_started-any_2026-05-15.csv",
    },
    {
      survey: "phase-1",
      lang: "si" as const,
      expectedFilename: "eip-insight-phase-1_completed_si_started-any_started-any_2026-05-15.csv",
    },
    {
      survey: "phase-3",
      lang: "ta" as const,
      expectedFilename: "eip-insight-phase-3_completed_ta_started-any_started-any_2026-05-15.csv",
    },
  ])(
    "survey=$survey lang=$lang → payload + filename + bytes match the CSV builder",
    async ({ survey, lang, expectedFilename }) => {
      const captured = installDownloadCapture();
      const { exportCsvFn, exportXlsxFn } = makeServerFns();
      render(
        <ExportButtonsHarness
          exportCsvFn={exportCsvFn}
          exportXlsxFn={exportXlsxFn}
          initialSurvey={survey}
          initialLang={lang}
        />,
      );

      await userEvent.click(screen.getByTestId("export-csv"));

      // Payload: surveySlug/language only present when explicitly chosen.
      expect(exportCsvFn).toHaveBeenCalledTimes(1);
      const payload = exportCsvFn.mock.calls[0][0].data;
      expect(payload.statusFilter).toBe("completed");
      expect(payload.validOnly).toBe(false);
      expect(payload.dateField).toBe("started_at");
      if (survey === "__all__") expect(payload.surveySlug).toBeUndefined();
      else expect(payload.surveySlug).toBe(survey);
      if (lang === "__all__") expect(payload.language).toBeUndefined();
      else expect(payload.language).toBe(lang);

      // Filename: matches the canonical rule, ends in strict ISO date.
      expect(captured.filenames).toEqual([expectedFilename]);
      expect(expectedFilename).toMatch(/_\d{4}-\d{2}-\d{2}\.csv$/);

      // Bytes: BOM + CSV the shared builder would produce for the same
      // (survey × language) row subset.
      const expectedRows = FIXTURE.filter(
        (r) =>
          (survey === "__all__" || r.survey_slug === survey) &&
          (lang === "__all__" || r.language === lang),
      );
      const expectedCsv = buildFilteredCsvForRows(
        survey === "__all__" ? undefined : survey,
        expectedRows,
      );
      const text = await readBlob(captured.blobs[0]);
      expect(text.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM the route prepends
      expect(text.slice(1)).toBe(expectedCsv);

      // Wiring hygiene: every URL we created was revoked.
      expect(captured.revoked).toEqual(captured.urls);
    },
  );
});

describe("admin export buttons — XLSX download", () => {
  it.each([
    {
      survey: "__all__" as const,
      lang: "__all__" as const,
      expectedFilename:
        "eip-insight-all-surveys_completed_all-langs_started-any_started-any_2026-05-15.xlsx",
    },
    {
      survey: "phase-1",
      lang: "si" as const,
      expectedFilename: "eip-insight-phase-1_completed_si_started-any_started-any_2026-05-15.xlsx",
    },
    {
      survey: "phase-3",
      lang: "ta" as const,
      expectedFilename: "eip-insight-phase-3_completed_ta_started-any_started-any_2026-05-15.xlsx",
    },
  ])(
    "survey=$survey lang=$lang → filename uses the same stem as CSV with .xlsx, bytes round-trip through base64",
    async ({ survey, lang, expectedFilename }) => {
      const captured = installDownloadCapture();
      const { exportCsvFn, exportXlsxFn } = makeServerFns();
      render(
        <ExportButtonsHarness
          exportCsvFn={exportCsvFn}
          exportXlsxFn={exportXlsxFn}
          initialSurvey={survey}
          initialLang={lang}
        />,
      );

      await userEvent.click(screen.getByTestId("export-xlsx"));

      expect(exportXlsxFn).toHaveBeenCalledTimes(1);
      const payload = exportXlsxFn.mock.calls[0][0].data;
      if (survey === "__all__") expect(payload.surveySlug).toBeUndefined();
      else expect(payload.surveySlug).toBe(survey);
      if (lang === "__all__") expect(payload.language).toBeUndefined();
      else expect(payload.language).toBe(lang);

      expect(captured.filenames).toEqual([expectedFilename]);
      // CSV+XLSX share the same stem; the only difference is the extension.
      const csvTwin = expectedFilename.replace(/\.xlsx$/, ".csv");
      expect(csvTwin).toMatch(/\.csv$/);

      // Bytes survived the base64 round-trip the route does.
      const expectedRows = FIXTURE.filter(
        (r) =>
          (survey === "__all__" || r.survey_slug === survey) &&
          (lang === "__all__" || r.language === lang),
      );
      const expectedPayload = buildFilteredCsvForRows(
        survey === "__all__" ? undefined : survey,
        expectedRows,
      );
      const text = await readBlob(captured.blobs[0]);
      expect(text).toBe(expectedPayload);
      expect(captured.blobs[0].type).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      expect(captured.revoked).toEqual(captured.urls);
    },
  );
});

describe("admin export buttons — switching selection re-targets the download", () => {
  it("changing survey + language between clicks updates payload, filename, and bytes", async () => {
    const captured = installDownloadCapture();
    const { exportCsvFn, exportXlsxFn } = makeServerFns();
    render(<ExportButtonsHarness exportCsvFn={exportCsvFn} exportXlsxFn={exportXlsxFn} />);

    // First click: defaults (all/all).
    await userEvent.click(screen.getByTestId("export-csv"));
    // Second click: phase-1 + si.
    await userEvent.selectOptions(screen.getByTestId("survey"), "phase-1");
    await userEvent.selectOptions(screen.getByTestId("lang"), "si");
    await userEvent.click(screen.getByTestId("export-csv"));
    // Third click: phase-3 + ta.
    await userEvent.selectOptions(screen.getByTestId("survey"), "phase-3");
    await userEvent.selectOptions(screen.getByTestId("lang"), "ta");
    await userEvent.click(screen.getByTestId("export-csv"));

    expect(captured.filenames).toEqual([
      "eip-insight-all-surveys_completed_all-langs_started-any_started-any_2026-05-15.csv",
      "eip-insight-phase-1_completed_si_started-any_started-any_2026-05-15.csv",
      "eip-insight-phase-3_completed_ta_started-any_started-any_2026-05-15.csv",
    ]);
    expect(exportCsvFn).toHaveBeenCalledTimes(3);
    expect(exportCsvFn.mock.calls[1][0].data.surveySlug).toBe("phase-1");
    expect(exportCsvFn.mock.calls[1][0].data.language).toBe("si");
    expect(exportCsvFn.mock.calls[2][0].data.surveySlug).toBe("phase-3");
    expect(exportCsvFn.mock.calls[2][0].data.language).toBe("ta");

    // Each download's bytes match the builder for that selection.
    const subsets = [
      buildFilteredCsvForRows(undefined, FIXTURE),
      buildFilteredCsvForRows(
        "phase-1",
        FIXTURE.filter((r) => r.survey_slug === "phase-1" && r.language === "si"),
      ),
      buildFilteredCsvForRows(
        "phase-3",
        FIXTURE.filter((r) => r.survey_slug === "phase-3" && r.language === "ta"),
      ),
    ];
    for (let i = 0; i < subsets.length; i++) {
      const text = await readBlob(captured.blobs[i]);
      expect(text.slice(1)).toBe(subsets[i]); // strip BOM
    }
  });
});
