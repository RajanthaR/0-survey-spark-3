/**
 * E2E test for the admin "Export CSV" pipeline. Seeds a known set of
 * submitted survey responses (the rows the Supabase `responses` table
 * would yield for the selected survey), runs them through the same
 * `buildResponsesCsv` helper that the `exportCsv` server function (wired to
 * the admin Download button) calls, then parses the resulting CSV with a
 * real RFC-4180 tokenizer and asserts every submitted answer survives the
 * round-trip — including JSON-encoded multi-select arrays, object answers,
 * and values containing commas + newlines.
 *
 * This is the "did the export actually preserve the user's data?" check
 * that the shape-only tests in csv-export-shape.test.ts cannot make.
 */
import { describe, it, expect } from "vitest";
import {
  buildResponsesCsv,
  RESPONSES_CSV_META_HEADERS,
  type ResponseRow,
} from "@/lib/responses-csv";

/** Minimal RFC-4180 row tokenizer: respects quotes, escaped quotes, \n. */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"' && csv[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') { inQuotes = false; }
      else { cell += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell); cell = "";
    } else if (ch === "\n") {
      row.push(cell); rows.push(row); row = []; cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

/**
 * Simulates the browser side of the admin Download flow: takes the CSV
 * payload returned by the server fn, wraps it in a Blob (the same way
 * downloadCsv() in src/routes/admin.tsx does), then reads the Blob back as
 * text — proving the CSV survives the Blob round-trip the user actually
 * downloads.
 */
async function downloadAndReadBlob(csv: string): Promise<string> {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  return await blob.text();
}

describe("admin Download CSV — submitted answers round-trip", () => {
  it("downloads a CSV whose rows reproduce every submitted answer", async () => {
    // Submitted answers fixture: rows the responses table would surface for
    // the phase-1 survey, ordered started_at-desc as the server fn returns.
    // Covers every value shape we save: plain string, integer-ish progress,
    // multi-select array, JSON object, and a string with a comma + newline
    // (which forces RFC-4180 quoting).
    const submitted: ResponseRow[] = [
      {
        id: "resp-2",
        status: "in_progress",
        language: "si",
        progress_pct: 40,
        started_at: "2026-05-02T09:00:00.000Z",
        completed_at: null,
        contact: null,
        answers: { q_text: "Second", q_multi: ["a"] },
      },
      {
        id: "resp-1",
        status: "completed",
        language: "en",
        progress_pct: 100,
        started_at: "2026-05-01T10:00:00.000Z",
        completed_at: "2026-05-01T10:12:00.000Z",
        contact: { name: "Alice", email: "a@x.test", organization: "Org A" },
        answers: {
          q_text: "Hello, world\nwith newline",
          q_choice: "yes",
          q_multi: ["a", "b", "c"],
          q_meta: { score: 7, tag: "x" },
        },
      },
    ];

    const result = buildResponsesCsv(submitted, "phase-1");

    expect(result.rowCount).toBe(2);
    expect(result.filename).toBe("phase-1-responses.csv");

    // Round-trip through a Blob the same way the admin button does.
    const csvText = await downloadAndReadBlob(result.csv);
    const rows = parseCsv(csvText);
    const [header, ...body] = rows;

    // Headers: fixed meta cols + sorted union of answer keys across rows.
    expect(header.slice(0, RESPONSES_CSV_META_HEADERS.length)).toEqual([
      ...RESPONSES_CSV_META_HEADERS,
    ]);
    const answerCols = header.slice(RESPONSES_CSV_META_HEADERS.length);
    expect(answerCols).toEqual(["q_choice", "q_meta", "q_multi", "q_text"]);

    // One body row per submitted response, key-able by id.
    expect(body.length).toBe(2);
    const byId = Object.fromEntries(body.map((r) => [r[0], r]));
    const idx = (k: string) => header.indexOf(k);

    // Completed response: every meta + answer field reproduced verbatim.
    const r1 = byId["resp-1"];
    expect(r1).toBeDefined();
    expect(r1[idx("status")]).toBe("completed");
    expect(r1[idx("language")]).toBe("en");
    expect(r1[idx("progress_pct")]).toBe("100");
    expect(r1[idx("started_at")]).toBe("2026-05-01T10:00:00.000Z");
    expect(r1[idx("completed_at")]).toBe("2026-05-01T10:12:00.000Z");
    expect(r1[idx("contact_name")]).toBe("Alice");
    expect(r1[idx("contact_email")]).toBe("a@x.test");
    expect(r1[idx("contact_org")]).toBe("Org A");
    expect(r1[idx("q_text")]).toBe("Hello, world\nwith newline");
    expect(r1[idx("q_choice")]).toBe("yes");
    expect(JSON.parse(r1[idx("q_multi")])).toEqual(["a", "b", "c"]);
    expect(JSON.parse(r1[idx("q_meta")])).toEqual({ score: 7, tag: "x" });

    // In-progress response: missing answers + missing contact → empty cells,
    // present answers still survive intact.
    const r2 = byId["resp-2"];
    expect(r2[idx("status")]).toBe("in_progress");
    expect(r2[idx("completed_at")]).toBe("");
    expect(r2[idx("contact_name")]).toBe("");
    expect(r2[idx("contact_email")]).toBe("");
    expect(r2[idx("q_text")]).toBe("Second");
    expect(JSON.parse(r2[idx("q_multi")])).toEqual(["a"]);
    expect(r2[idx("q_choice")]).toBe(""); // never answered
    expect(r2[idx("q_meta")]).toBe("");
  });

  it("emits a header-only CSV when no responses match the survey", async () => {
    const result = buildResponsesCsv([], "phase-1");
    expect(result.rowCount).toBe(0);
    expect(result.filename).toBe("phase-1-responses.csv");
    const rows = parseCsv(await downloadAndReadBlob(result.csv));
    expect(rows.length).toBe(1); // header only — no body
    expect(rows[0]).toEqual([...RESPONSES_CSV_META_HEADERS]);
  });

  it("namespaces answer columns by the union of keys, never leaking unrelated keys", async () => {
    // If two rows have different answer keys, the export emits the SORTED
    // union and fills missing values as empty cells — ensuring no row
    // accidentally inherits another respondent's answers.
    const submitted: ResponseRow[] = [
      {
        id: "r-a",
        status: "completed",
        language: "en",
        progress_pct: 100,
        started_at: "2026-05-01T10:00:00.000Z",
        completed_at: "2026-05-01T10:01:00.000Z",
        answers: { only_in_a: "A" },
      },
      {
        id: "r-b",
        status: "completed",
        language: "ta",
        progress_pct: 100,
        started_at: "2026-05-01T11:00:00.000Z",
        completed_at: "2026-05-01T11:01:00.000Z",
        answers: { only_in_b: "B" },
      },
    ];
    const { csv } = buildResponsesCsv(submitted, "phase-1");
    const [header, ...body] = parseCsv(await downloadAndReadBlob(csv));
    const answerCols = header.slice(RESPONSES_CSV_META_HEADERS.length);
    expect(answerCols).toEqual(["only_in_a", "only_in_b"]);
    const byId = Object.fromEntries(body.map((r) => [r[0], r]));
    expect(byId["r-a"][header.indexOf("only_in_a")]).toBe("A");
    expect(byId["r-a"][header.indexOf("only_in_b")]).toBe("");
    expect(byId["r-b"][header.indexOf("only_in_a")]).toBe("");
    expect(byId["r-b"][header.indexOf("only_in_b")]).toBe("B");
  });
});
