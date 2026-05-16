/**
 * End-to-end resume-after-refresh contract for the streaming all-valid
 * XLSX export.
 *
 * Exercises the full pipeline the admin route relies on:
 *
 *   1. Run `streamAllValidXlsxImpl` uninterrupted on a 6-row, 3-page
 *      fixture and assemble the baseline workbook (header + rows) the
 *      same way `downloadAllValidXlsx` does in `src/routes/admin.tsx`.
 *   2. Simulate a transient failure mid-stream after page 0 — buffer
 *      what we have, persist it to a fake `localStorage` under the
 *      same `XLSX_RESUME_KEY` shape the admin route writes
 *      (`{ buffer, failedRun, savedAt }`), and drop the in-memory
 *      state.
 *   3. Simulate a browser refresh — re-read the buffer from
 *      localStorage, validate the persisted shape, and reissue the
 *      stream with `startPage = lastPage + 1` and the same
 *      `requestId` (matching the resume path the route uses).
 *   4. Concatenate the persisted prior rows with the resumed chunks,
 *      assemble the workbook the same way, and assert the resumed
 *      workbook's sheet (header row + every data row, cell-by-cell)
 *      is identical to the uninterrupted baseline — no missing
 *      rows, no duplicates, no header drift.
 *
 * Comparing parsed sheet contents (not raw zip bytes) is intentional:
 * .xlsx files embed timestamps inside the zip so byte-equality would
 * be flaky, but the cell grid is the actual user-visible payload.
 */
import { describe, it, expect, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import {
  streamAllValidXlsxImpl,
  type StreamAllValidXlsxEvent,
} from "@/lib/admin.functions";

// ── Minimal localStorage shim (no DOM in this test file) ─────────────
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
}
const storage = new MemoryStorage();

// Must match the key in src/routes/admin.tsx.
const XLSX_RESUME_KEY = "eip-insight:admin:resumeBuffer:xlsx:v1";

const FIXED_NOW = () => new Date("2026-05-15T00:00:00.000Z");
const PAGE_SIZE = 2;
const REQUEST_ID = "req-xlsx-refresh-e2e-0001";

function makeRow(id: string) {
  return {
    id,
    survey_slug: "survey1",
    language: "en",
    status: "completed",
    progress_pct: 100,
    started_at: "2026-05-15T10:00:00.000Z",
    completed_at: "2026-05-15T10:05:00.000Z",
    contact: { name: `name-${id}`, email: `${id}@example.com`, organization: "" },
    answers: {},
  };
}

// 3 pages × 2 rows = 6 rows total.
const PAGES = [
  [makeRow("a"), makeRow("b")],
  [makeRow("c"), makeRow("d")],
  [makeRow("e"), makeRow("f")],
];

async function collect(
  gen: AsyncGenerator<StreamAllValidXlsxEvent>,
): Promise<StreamAllValidXlsxEvent[]> {
  const out: StreamAllValidXlsxEvent[] = [];
  for await (const evt of gen) out.push(evt);
  return out;
}

const chunksOf = (events: StreamAllValidXlsxEvent[]) =>
  events.filter(
    (e): e is Extract<StreamAllValidXlsxEvent, { type: "chunk" }> =>
      e.type === "chunk",
  );
const metaOf = (events: StreamAllValidXlsxEvent[]) =>
  events.find(
    (e): e is Extract<StreamAllValidXlsxEvent, { type: "meta" }> =>
      e.type === "meta",
  )!;

/**
 * Mirrors the workbook assembly in `downloadAllValidXlsx` so the test
 * compares the same artefact the admin actually downloads. Returns the
 * sheet as an array-of-arrays (header row + data rows) for stable
 * comparison — raw .xlsx bytes embed timestamps and would be flaky.
 */
function assembleWorkbookSheet(
  headerRow: string[],
  rows: (string | number | boolean | null)[][],
): unknown[][] {
  const aoa: (string | number | boolean | null)[][] = [headerRow, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa as (string | number)[][]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Responses");
  // Round-trip through the actual writer so we exercise the same code
  // path the admin route does — catches any encoder-level drift
  // between the baseline and the resumed assembly.
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const reopened = XLSX.read(new Uint8Array(buf), { type: "array" });
  expect(reopened.SheetNames).toEqual(["Responses"]);
  const sheet = reopened.Sheets["Responses"];
  return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
}

describe("XLSX export — resume after refresh matches uninterrupted run (e2e)", () => {
  beforeEach(() => storage.clear());

  it("reassembles the same workbook after a mid-stream failure + persisted resume + refresh", async () => {
    // ── 1. Baseline: uninterrupted run over all 3 pages ─────────────
    const baselineEvents = await collect(
      streamAllValidXlsxImpl({
        countCompleted: async () => 6,
        fetchPage: async (page) => PAGES[page] ?? [],
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: PAGE_SIZE,
        requestId: REQUEST_ID,
      }),
    );
    const baselineMeta = metaOf(baselineEvents);
    const baselineRows = chunksOf(baselineEvents).flatMap((c) => c.rows);
    expect(baselineRows).toHaveLength(6);
    const baselineSheet = assembleWorkbookSheet(
      baselineMeta.headerRow,
      baselineRows,
    );

    // ── 2. First attempt: succeed on page 0, then "fail" after it ──
    //    (we simulate the failure by only feeding back page 0 and
    //    bailing out of the loop early so partial state mirrors what
    //    the admin route would buffer before throwing.)
    const firstAttemptEvents = await collect(
      streamAllValidXlsxImpl({
        countCompleted: async () => 6,
        fetchPage: async (page) => (page === 0 ? PAGES[0] : []),
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: PAGE_SIZE,
        requestId: REQUEST_ID,
      }),
    );
    const firstMeta = metaOf(firstAttemptEvents);
    const firstChunks = chunksOf(firstAttemptEvents).filter((c) => c.page === 0);
    const firstRows = firstChunks.flatMap((c) => c.rows);
    expect(firstRows).toHaveLength(2);
    const lastPageBeforeFailure = 0;
    const rowCountBeforeFailure = firstRows.length;

    // ── 3. Persist the partial buffer the same way `saveXlsxResume`
    //    does in src/routes/admin.tsx, then drop the in-memory state.
    const persistedPayload = {
      buffer: {
        filename: firstMeta.filename,
        total: firstMeta.total,
        pageSize: firstMeta.pageSize,
        requestId: firstMeta.requestId,
        headerRow: [...firstMeta.headerRow],
        rows: firstRows,
        rowCount: rowCountBeforeFailure,
        lastPage: lastPageBeforeFailure,
      },
      failedRun: {
        error: "simulated transient failure after page 0",
        requestId: firstMeta.requestId,
        rowCount: rowCountBeforeFailure,
        lastPage: lastPageBeforeFailure,
        canResume: true,
      },
      savedAt: Date.now(),
    };
    storage.setItem(XLSX_RESUME_KEY, JSON.stringify(persistedPayload));

    // Drop everything held in memory — this is the "page refresh" line.
    let inMemoryHeader: string[] | null = null;
    let inMemoryRows: (string | number | boolean | null)[][] | null = null;
    let inMemoryRequestId: string | null = null;
    expect(inMemoryHeader).toBeNull();
    expect(inMemoryRows).toBeNull();
    expect(inMemoryRequestId).toBeNull();

    // ── 4. Refresh: rehydrate from localStorage exactly the way the
    //    admin route's mount-time hydration effect does.
    const raw = storage.getItem(XLSX_RESUME_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as typeof persistedPayload;
    expect(parsed.buffer).toBeDefined();
    expect(parsed.failedRun.canResume).toBe(true);
    expect(Array.isArray(parsed.buffer.rows)).toBe(true);
    expect(Array.isArray(parsed.buffer.headerRow)).toBe(true);
    expect(parsed.buffer.lastPage).toBe(lastPageBeforeFailure);
    expect(parsed.buffer.rowCount).toBe(rowCountBeforeFailure);
    expect(parsed.buffer.requestId).toBe(REQUEST_ID);
    inMemoryHeader = [...parsed.buffer.headerRow];
    inMemoryRows = [...parsed.buffer.rows];
    inMemoryRequestId = parsed.buffer.requestId;

    // ── 5. Resume: reissue the stream with startPage = lastPage + 1
    //    and the same requestId — mirrors `resumeAllValidXlsxFromLastPage`.
    const fetchCalls: number[] = [];
    const resumedEvents = await collect(
      streamAllValidXlsxImpl({
        countCompleted: async () => 6,
        fetchPage: async (page) => {
          fetchCalls.push(page);
          return PAGES[page] ?? [];
        },
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: PAGE_SIZE,
        startPage: lastPageBeforeFailure + 1,
        requestId: inMemoryRequestId!,
      }),
    );
    // Server must NOT re-fetch the persisted page — that's the whole
    // point of the resume contract; if it did, page-level dedup would
    // catch it but we want to verify the wire-level guarantee here.
    expect(fetchCalls).not.toContain(lastPageBeforeFailure);
    expect(fetchCalls[0]).toBe(lastPageBeforeFailure + 1);

    const resumedMeta = metaOf(resumedEvents);
    expect(resumedMeta.requestId).toBe(REQUEST_ID);
    // Header on the resumed run must match the persisted header byte-for-byte.
    expect(resumedMeta.headerRow).toEqual(inMemoryHeader);
    const resumedRows = chunksOf(resumedEvents).flatMap((c) => c.rows);
    expect(resumedRows).toHaveLength(4); // pages 1 + 2

    // ── 6. Assemble the resumed workbook the same way the admin
    //    route does and compare cell-by-cell against the baseline.
    const combinedRows = [...inMemoryRows!, ...resumedRows];
    expect(combinedRows).toHaveLength(6);
    const resumedSheet = assembleWorkbookSheet(resumedMeta.headerRow, combinedRows);

    expect(resumedSheet).toEqual(baselineSheet);
    // And the headers line up (defensive — sheet_to_json keeps them as row 0).
    expect(resumedSheet[0]).toEqual(baselineSheet[0]);
    // Every data row matches in the same order (no duplicates, no gaps).
    for (let r = 1; r < baselineSheet.length; r++) {
      expect(resumedSheet[r]).toEqual(baselineSheet[r]);
    }
    // No duplicate response ids smuggled in by the resume.
    const ids = combinedRows.map((row) => row[1]); // col 1 = response id
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});
