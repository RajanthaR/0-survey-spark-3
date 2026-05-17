/**
 * Verifies the streaming all-valid CSV export's wire protocol via the
 * `streamAllValidCsvImpl` pure helper. The contract under test:
 *
 *   - Exactly one `meta` event, emitted FIRST, with the canonical filename
 *     (`eip-insight-all-valid-responses-YYYY-MM-DD.csv`), the total row
 *     count from `countCompleted`, and a header line that matches
 *     `buildExportHeaderRow(buildExportColumns())`.
 *   - One `chunk` per non-empty page, with monotonically-increasing
 *     `processed` capped at `total`, a `\n`-terminated CSV slice, and the
 *     same number of CSV lines as rows in the page.
 *   - Exactly one `done` event, emitted LAST, with `rowCount === processed`.
 *   - No data events after `done`.
 *   - Retry/backoff: a transient `fetchPage` failure yields one `warn` event
 *     and is followed by the recovered `chunk`. A permanent failure throws
 *     a labeled error after `maxAttempts` and never emits `done`.
 *   - `total === 0` short-circuits to `meta` → `done` with no chunks.
 *
 * Uses fake `countCompleted` / `fetchPage` deps + a no-op `sleep` so the
 * test runs synchronously regardless of the backoff schedule.
 */
import { describe, it, expect } from "vitest";
import { streamAllValidCsvImpl, type StreamAllValidEvent } from "@/lib/admin.shared.server";
import { buildExportColumns, buildExportHeaderRow } from "@/lib/csv-export-shape";

function escape(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const EXPECTED_HEADER_LINE = buildExportHeaderRow(buildExportColumns()).map(escape).join(",");

const FIXED_NOW = () => new Date("2026-05-15T00:00:00.000Z");

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

async function collect(gen: AsyncGenerator<StreamAllValidEvent>): Promise<StreamAllValidEvent[]> {
  const out: StreamAllValidEvent[] = [];
  for await (const evt of gen) out.push(evt);
  return out;
}

describe("streamAllValidCsvImpl — wire protocol", () => {
  it("emits meta → chunk(s) → done in order with the correct shapes", async () => {
    const pages: Record<string, unknown>[][] = [
      [makeRow("a"), makeRow("b"), makeRow("c")],
      [makeRow("d"), makeRow("e")],
    ];
    const events = await collect(
      streamAllValidCsvImpl({
        countCompleted: async () => 5,
        fetchPage: async (page) => pages[page] ?? [],
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 3,
      }),
    );

    // First event is meta with the canonical shape.
    expect(events[0]).toMatchObject({
      type: "meta",
      total: 5,
      filename: "eip-insight-all-valid-responses-2026-05-15.csv",
      headerLine: EXPECTED_HEADER_LINE,
    });

    // Last event is done with rowCount equal to the sum of page sizes.
    const last = events[events.length - 1];
    expect(last).toEqual({ type: "done", rowCount: 5 });

    // Between meta and done, exactly two chunks (one per non-empty page).
    const chunks = events.filter((e) => e.type === "chunk");
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ processed: 3, total: 5 });
    expect(chunks[1]).toMatchObject({ processed: 5, total: 5 });

    // CSV slices are non-empty, newline-terminated, and have the right
    // number of lines.
    expect(chunks[0].type === "chunk" && chunks[0].csv.endsWith("\n")).toBe(true);
    expect(chunks[0].type === "chunk" && chunks[0].csv.trimEnd().split("\n")).toHaveLength(3);
    expect(chunks[1].type === "chunk" && chunks[1].csv.trimEnd().split("\n")).toHaveLength(2);

    // No event types other than the ones above.
    expect(new Set(events.map((e) => e.type))).toEqual(
      new Set(["meta", "chunk", "checksum", "done"]),
    );
  });

  it("short-circuits to meta → done when total === 0 (no chunks)", async () => {
    const events = await collect(
      streamAllValidCsvImpl({
        countCompleted: async () => 0,
        fetchPage: async () => {
          throw new Error("fetchPage must not be called when total is 0");
        },
        sleep: async () => {},
        now: FIXED_NOW,
      }),
    );
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      type: "meta",
      total: 0,
      filename: "eip-insight-all-valid-responses-2026-05-15.csv",
      headerLine: EXPECTED_HEADER_LINE,
      startPage: 0,
      pageSize: 500,
    });
    // requestId is auto-generated and non-empty.
    expect(
      events[0].type === "meta" &&
        typeof events[0].requestId === "string" &&
        events[0].requestId.length >= 8,
    ).toBe(true);
    expect(events[1]).toMatchObject({ type: "checksum" });
    expect(events[2]).toEqual({ type: "done", rowCount: 0 });
  });

  it("processed counts are monotonic and never exceed total", async () => {
    // Full-size pages keep streaming; a short page (or empty) terminates.
    const pages = [
      [makeRow("a"), makeRow("b")],
      [makeRow("c"), makeRow("d")],
      [makeRow("e"), makeRow("f")],
    ];
    const events = await collect(
      streamAllValidCsvImpl({
        countCompleted: async () => 6,
        fetchPage: async (page) => pages[page] ?? [],
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 2,
      }),
    );
    const processedSeq = events
      .filter((e): e is Extract<StreamAllValidEvent, { type: "chunk" }> => e.type === "chunk")
      .map((e) => e.processed);
    expect(processedSeq).toEqual([2, 4, 6]);
    for (let i = 1; i < processedSeq.length; i += 1) {
      expect(processedSeq[i]).toBeGreaterThan(processedSeq[i - 1]);
    }
    expect(processedSeq[processedSeq.length - 1]).toBeLessThanOrEqual(6);
  });

  it("ends after the first short page (rows.length < pageSize) without re-querying", async () => {
    let calls = 0;
    const pages = [
      [makeRow("a"), makeRow("b"), makeRow("c")],
      [makeRow("d")], // short — should be the last fetch
    ];
    const events = await collect(
      streamAllValidCsvImpl({
        countCompleted: async () => 4,
        fetchPage: async (page) => {
          calls += 1;
          return pages[page] ?? [];
        },
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 3,
      }),
    );
    expect(calls).toBe(2);
    const done = events.at(-1);
    expect(done).toEqual({ type: "done", rowCount: 4 });
  });
});

describe("streamAllValidCsvImpl — retry / backoff", () => {
  it("yields a warn event then recovers when fetchPage succeeds on retry", async () => {
    let page0Attempts = 0;
    const events = await collect(
      streamAllValidCsvImpl({
        countCompleted: async () => 1,
        fetchPage: async (page) => {
          if (page > 0) return [];
          page0Attempts += 1;
          if (page0Attempts === 1) throw new Error("ECONNRESET");
          return [makeRow("a")];
        },
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 1,
      }),
    );
    const warns = events.filter((e) => e.type === "warn");
    expect(warns).toHaveLength(1);
    expect(warns[0]).toMatchObject({
      type: "warn",
      attempt: 1,
      maxAttempts: 3,
      message: "ECONNRESET",
    });
    expect(warns[0].type === "warn" && warns[0].label).toMatch(/Fetching page 1/);
    // The chunk that recovered after the retry follows the warn.
    expect(events.filter((e) => e.type === "chunk")).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: "done", rowCount: 1 });
  });

  it("throws a labeled error after maxAttempts and never emits done", async () => {
    const run = streamAllValidCsvImpl({
      countCompleted: async () => 1,
      fetchPage: async () => {
        throw new Error("boom");
      },
      sleep: async () => {},
      now: FIXED_NOW,
      pageSize: 1,
      maxAttempts: 3,
    });
    const collected: StreamAllValidEvent[] = [];
    await expect(async () => {
      for await (const e of run) collected.push(e);
    }).rejects.toThrowError(/Fetching page 1.*failed after 3 attempts.*boom/);
    // We saw meta + 2 warns, but no done.
    expect(collected.filter((e) => e.type === "meta")).toHaveLength(1);
    expect(collected.filter((e) => e.type === "warn")).toHaveLength(2);
    expect(collected.some((e) => e.type === "done")).toBe(false);
  });

  it("retries the count step too and labels the error with that step", async () => {
    let countAttempts = 0;
    const run = streamAllValidCsvImpl({
      countCompleted: async () => {
        countAttempts += 1;
        throw new Error("db is down");
      },
      fetchPage: async () => [],
      sleep: async () => {},
      now: FIXED_NOW,
    });
    await expect(async () => {
      for await (const _ of run) void _;
    }).rejects.toThrowError(/Counting completed responses failed after 3 attempts.*db is down/);
    expect(countAttempts).toBe(3);
  });
});

describe("streamAllValidCsvImpl — resume / tuning / correlation", () => {
  it("resumes from `startPage`, skipping earlier pages and seeding processed", async () => {
    const calls: number[] = [];
    const events = await collect(
      streamAllValidCsvImpl({
        countCompleted: async () => 6,
        fetchPage: async (page) => {
          calls.push(page);
          // Two-row pages, only page 2 has rows when resuming from page 2.
          if (page === 2) return [makeRow("e"), makeRow("f")];
          return [];
        },
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 2,
        startPage: 2,
      }),
    );
    // Server skipped pages 0 and 1 entirely.
    expect(calls[0]).toBe(2);
    // Meta echoes the resume offset + effective page size.
    expect(events[0]).toMatchObject({ type: "meta", startPage: 2, pageSize: 2, total: 6 });
    // Processed on the resumed chunk includes the implicit 2*2=4 rows
    // the prior attempt already streamed (2 from page 2 + 4 carry-over = 6).
    const chunks = events.filter(
      (e): e is Extract<StreamAllValidEvent, { type: "chunk" }> => e.type === "chunk",
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ processed: 6, page: 2 });
    expect(events.at(-1)).toEqual({ type: "done", rowCount: 6 });
  });

  it("emits `page` on every chunk so the client can resume from `lastPage + 1`", async () => {
    const events = await collect(
      streamAllValidCsvImpl({
        countCompleted: async () => 3,
        fetchPage: async (page) => {
          if (page === 0) return [makeRow("a")];
          if (page === 1) return [makeRow("b")];
          if (page === 2) return [makeRow("c")];
          return [];
        },
        sleep: async () => {},
        now: FIXED_NOW,
        pageSize: 1,
      }),
    );
    const chunks = events.filter(
      (e): e is Extract<StreamAllValidEvent, { type: "chunk" }> => e.type === "chunk",
    );
    expect(chunks.map((c) => c.page)).toEqual([0, 1, 2]);
  });

  it("respects custom `maxAttempts` + `baseDelayMs` + `backoffFactor` (sleep schedule)", async () => {
    const sleeps: number[] = [];
    let attempts = 0;
    const run = streamAllValidCsvImpl({
      countCompleted: async () => 1,
      fetchPage: async () => {
        attempts += 1;
        throw new Error("nope");
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      now: FIXED_NOW,
      pageSize: 1,
      maxAttempts: 4,
      baseDelayMs: 100,
      backoffFactor: 2,
    });
    await expect(async () => {
      for await (const _ of run) void _;
    }).rejects.toThrowError(/failed after 4 attempts/);
    expect(attempts).toBe(4);
    // Three sleeps between four attempts. Base 100, factor 2 → centres
    // 100, 200, 400 with ±20% jitter.
    expect(sleeps).toHaveLength(3);
    expect(sleeps[0]).toBeGreaterThanOrEqual(80);
    expect(sleeps[0]).toBeLessThanOrEqual(120);
    expect(sleeps[1]).toBeGreaterThanOrEqual(160);
    expect(sleeps[1]).toBeLessThanOrEqual(240);
    expect(sleeps[2]).toBeGreaterThanOrEqual(320);
    expect(sleeps[2]).toBeLessThanOrEqual(480);
  });

  it("echoes the caller-supplied `requestId` on meta + warn events and in the thrown error", async () => {
    const requestId = "req-abc-12345678";
    const events: StreamAllValidEvent[] = [];
    let pageCalls = 0;
    const run = streamAllValidCsvImpl({
      countCompleted: async () => 1,
      fetchPage: async () => {
        pageCalls += 1;
        if (pageCalls === 1) throw new Error("flaky");
        return [makeRow("a")];
      },
      sleep: async () => {},
      now: FIXED_NOW,
      pageSize: 1,
      requestId,
    });
    for await (const e of run) events.push(e);
    const meta = events.find((e) => e.type === "meta");
    expect(meta && meta.type === "meta" && meta.requestId).toBe(requestId);
    const warn = events.find((e) => e.type === "warn");
    expect(warn && warn.type === "warn" && warn.requestId).toBe(requestId);
  });

  it("includes the requestId in the thrown error after exhausting retries", async () => {
    const run = streamAllValidCsvImpl({
      countCompleted: async () => {
        throw new Error("db gone");
      },
      fetchPage: async () => [],
      sleep: async () => {},
      now: FIXED_NOW,
      requestId: "req-deadbeef-9999",
      maxAttempts: 2,
    });
    await expect(async () => {
      for await (const _ of run) void _;
    }).rejects.toThrowError(/\[requestId=req-deadbeef-9999\]/);
  });
});
