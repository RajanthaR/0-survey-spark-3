/**
 * Resume-from-last-page contract for the streaming all-valid XLSX export.
 *
 * Mirrors `streamAllValidCsv.protocol.test.ts` but focuses on the
 * specific guarantees the client relies on when reissuing
 * `streamAllValidXlsxImpl` with a `startPage` after a transient failure:
 *
 *   1. Earlier pages are NOT re-fetched — the server jumps straight to
 *      `startPage` (so the client never has to dedupe rows).
 *   2. The `meta` event still carries the same canonical `headerRow`
 *      (and same `requestId` when one is supplied), so the client can
 *      validate that the workbook header it already buffered still
 *      matches the resumed run.
 *   3. `processed` on resumed chunks is seeded with `startPage * pageSize`
 *      carry-over rows + the new page's rows — i.e. the client can
 *      append the new rows directly to its prior buffer and trust the
 *      progress counter.
 *   4. Splitting a full run into "first attempt up to lastPage" +
 *      "resumed from lastPage + 1" yields exactly the same row set as
 *      a single uninterrupted run, with no duplicates.
 *   5. `total === 0` short-circuits even with a non-zero `startPage`
 *      (no fetch calls), and emits `meta` → `done`.
 */
import { describe, it, expect } from "vitest";
import {
  streamAllValidXlsxImpl,
  type StreamAllValidXlsxEvent,
} from "@/lib/admin.functions";
import {
  buildExportColumns,
  buildExportHeaderRow,
} from "@/lib/csv-export-shape";

const FIXED_NOW = () => new Date("2026-05-15T00:00:00.000Z");
const EXPECTED_HEADER_ROW = buildExportHeaderRow(buildExportColumns());

function makeRow(id: string, slug = "survey1") {
  return {
    id,
    survey_slug: slug,
    language: "en",
    status: "completed",
    progress_pct: 100,
    started_at: "2026-05-15T10:00:00.000Z",
    completed_at: "2026-05-15T10:05:00.000Z",
    contact: { name: "X", email: "x@y", organization: "" },
    answers: {},
  };
}

async function collect(
  gen: AsyncGenerator<StreamAllValidXlsxEvent>,
): Promise<StreamAllValidXlsxEvent[]> {
  const out: StreamAllValidXlsxEvent[] = [];
  for await (const evt of gen) out.push(evt);
  return out;
}

const chunksOf = (
  events: StreamAllValidXlsxEvent[],
): Extract<StreamAllValidXlsxEvent, { type: "chunk" }>[] =>
  events.filter(
    (e): e is Extract<StreamAllValidXlsxEvent, { type: "chunk" }> =>
      e.type === "chunk",
  );

const metaOf = (events: StreamAllValidXlsxEvent[]) =>
  events.find(
    (e): e is Extract<StreamAllValidXlsxEvent, { type: "meta" }> =>
      e.type === "meta",
  )!;

describe("streamAllValidXlsxImpl — resume from last page", () => {
  it("does not re-fetch pages before `startPage`", async () => {
    const calls: number[] = [];
    const events = await collect(
      streamAllValidXlsxImpl({
        countCompleted: async () => 6,
        fetchPage: async (page) => {
          calls.push(page);
          if (page === 2) return [makeRow("e"), makeRow("f")];
          return [];
        },
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 2,
        startPage: 2,
      }),
    );
    // No fetches for pages 0 or 1 — the server jumps straight to startPage.
    expect(calls).not.toContain(0);
    expect(calls).not.toContain(1);
    expect(calls[0]).toBe(2);
    // Meta echoes the resume offset + page size + total.
    expect(events[0]).toMatchObject({
      type: "meta",
      startPage: 2,
      pageSize: 2,
      total: 6,
    });
    expect(events.at(-1)).toEqual({ type: "done", rowCount: 6 });
  });

  it("preserves the canonical headerRow across a resumed run", async () => {
    const events = await collect(
      streamAllValidXlsxImpl({
        countCompleted: async () => 4,
        fetchPage: async (page) =>
          page === 1 ? [makeRow("c"), makeRow("d")] : [],
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 2,
        startPage: 1,
      }),
    );
    const meta = metaOf(events);
    // The headerRow on a resumed run must match the headerRow the
    // initial attempt produced — otherwise the client's buffered
    // workbook header would silently disagree with new chunks.
    expect(meta.headerRow).toEqual(EXPECTED_HEADER_ROW);
    expect(meta.headerRow.length).toBeGreaterThan(0);
  });

  it("seeds `processed` with the carry-over rows so the counter is monotonic across attempts", async () => {
    // Resume from page 2 with pageSize=2 means 4 rows were "carried over"
    // by the prior attempt; the first resumed chunk should report
    // processed = 4 (carry-over) + 2 (new) = 6.
    const events = await collect(
      streamAllValidXlsxImpl({
        countCompleted: async () => 6,
        fetchPage: async (page) =>
          page === 2 ? [makeRow("e"), makeRow("f")] : [],
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 2,
        startPage: 2,
      }),
    );
    const chunks = chunksOf(events);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ processed: 6, page: 2 });
    expect(chunks[0].rows).toHaveLength(2);
  });

  it("a split run (page 0 then resumed from page 1) yields the same rows as a single run, with no duplicates", async () => {
    // Server fixture — three two-row pages, six rows total.
    const pages: ReturnType<typeof makeRow>[][] = [
      [makeRow("a"), makeRow("b")],
      [makeRow("c"), makeRow("d")],
      [makeRow("e"), makeRow("f")],
    ];
    // ── Single uninterrupted run ──
    const single = await collect(
      streamAllValidXlsxImpl({
        countCompleted: async () => 6,
        fetchPage: async (page) => pages[page] ?? [],
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 2,
      }),
    );
    const singleRows = chunksOf(single).flatMap((c) => c.rows);

    // ── Split run: first attempt fails after page 0 → client buffers
    //    page 0's rows and reissues with startPage=1. ──
    const firstHalf = await collect(
      streamAllValidXlsxImpl({
        countCompleted: async () => 6,
        // Only page 0 succeeds in the "first attempt".
        fetchPage: async (page) => (page === 0 ? pages[0] : []),
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 2,
        // Cap to exactly one page worth so this stops cleanly.
        startPage: 0,
      }),
    );
    const firstHalfRows = chunksOf(firstHalf)
      .filter((c) => c.page === 0)
      .flatMap((c) => c.rows);

    const resumed = await collect(
      streamAllValidXlsxImpl({
        countCompleted: async () => 6,
        fetchPage: async (page) => pages[page] ?? [],
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 2,
        startPage: 1,
      }),
    );
    const resumedRows = chunksOf(resumed).flatMap((c) => c.rows);

    // No page-0 rows in the resumed half — the client appends, never dedupes.
    const resumedPages = chunksOf(resumed).map((c) => c.page);
    expect(resumedPages).not.toContain(0);

    // Concatenating the prior buffer + resumed chunks reconstructs the
    // same row set as the single uninterrupted run, no duplicates.
    const combined = [...firstHalfRows, ...resumedRows];
    expect(combined).toEqual(singleRows);
    expect(combined).toHaveLength(6);
    // Sanity: every row id is unique.
    const ids = combined.map((r) => r[1]); // column index 1 is response id
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("echoes the caller-supplied requestId on the resumed meta event", async () => {
    const requestId = "req-xlsx-resume-1234";
    const events = await collect(
      streamAllValidXlsxImpl({
        countCompleted: async () => 2,
        fetchPage: async (page) => (page === 1 ? [makeRow("c"), makeRow("d")] : []),
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 2,
        startPage: 1,
        requestId,
      }),
    );
    expect(metaOf(events).requestId).toBe(requestId);
  });

  it("short-circuits to meta → done when total === 0 even with a non-zero startPage", async () => {
    let calls = 0;
    const events = await collect(
      streamAllValidXlsxImpl({
        countCompleted: async () => 0,
        fetchPage: async () => {
          calls += 1;
          return [];
        },
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 2,
        startPage: 3,
      }),
    );
    expect(calls).toBe(0);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: "meta",
      total: 0,
      startPage: 3,
      headerRow: EXPECTED_HEADER_ROW,
    });
    expect(events[1]).toEqual({ type: "done", rowCount: 0 });
  });
});
