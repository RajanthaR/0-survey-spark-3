/**
 * Integration test for the streaming-export progress UI as wired in
 * `src/routes/admin.tsx` → `downloadAllValidCsv` → `<AllValidProgressCard>`.
 *
 * The admin route itself drags in auth bootstrap, the Supabase client,
 * lazy recharts bundles, and ~15 server functions — none of which exercise
 * streaming. To get faithful coverage of the actual contract that matters
 * (server events → React state → rendered card) without that coupling,
 * we mount a small `<StreamingExportHarness>` that replicates the admin
 * loop verbatim (the meta/chunk/done branches at admin.tsx:474-513) and
 * drive it with the **real** `streamAllValidCsvImpl` generator — the same
 * one `streamAllValidCsv` server fn delegates to — wired to controllable
 * deferred `countCompleted` / `fetchPage` deps so we can step through
 * each phase and assert the rendered card in between.
 *
 * Verifies:
 *   1. Click → progress card appears in the "starting" phase ("Preparing
 *      export…", aria-valuenow = 0, no rate/ETA row).
 *   2. After `meta` resolves → card switches to "Streaming completed
 *      responses", aria-valuemax = total, percentage = 0%.
 *   3. After each `chunk` → `processed` count and percentage advance
 *      monotonically; the rate/ETA row is rendered.
 *   4. After `done` → card flips to "Finalizing CSV…", processed = total,
 *      100%, and the rate/ETA row disappears.
 *   5. After the loop unwinds → card unmounts (admin's `finally` clears
 *      `allValidProgress` to null).
 */
import { describe, it, expect } from "vitest";
import { useState } from "react";
import { flushSync } from "react-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  AllValidProgressCard,
  type AllValidProgress,
} from "@/components/admin/AllValidProgressCard";
import { streamAllValidCsvImpl, type StreamAllValidEvent } from "@/lib/admin.shared.server";

// ---------- deferred-promise helper ----------

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeRow(id: string) {
  return {
    id,
    survey_slug: "phase-1",
    language: "en",
    status: "completed",
    progress_pct: 100,
    started_at: "2026-05-15T10:00:00.000Z",
    completed_at: "2026-05-15T10:05:00.000Z",
    contact: { name: "X", email: "x@y", organization: "" },
    answers: {},
  };
}

/**
 * Test harness: an async generator factory whose `countCompleted` and
 * each `fetchPage(page)` await an externally-controlled `Deferred`, so
 * the test can resolve them one by one and assert the UI between phases.
 */
function makeControllableStream(opts: { total: number; pages: Record<string, unknown>[][] }) {
  const countD = deferred<number>();
  const pageDeferreds = opts.pages.map(() => deferred<Record<string, unknown>[]>());
  // Sentinel page so the impl's `rows.length < pageSize` early-exit fires
  // after the last real page (we use pageSize === page length).
  const stream = streamAllValidCsvImpl({
    countCompleted: () => countD.promise,
    fetchPage: (page) => {
      const d = pageDeferreds[page];
      if (!d) return Promise.resolve([]);
      return d.promise;
    },
    sleep: async () => {},
    now: () => new Date("2026-05-15T00:00:00.000Z"),
    pageSize: opts.pages[0]?.length ?? 1,
  });
  return {
    stream,
    resolveCount: () => countD.resolve(opts.total),
    resolvePage: (i: number) => pageDeferreds[i].resolve(opts.pages[i]),
  };
}

// ---------- harness component (mirrors admin's downloadAllValidCsv loop) ----------

function StreamingExportHarness({
  streamFactory,
  /**
   * When true, mirrors admin's `finally { setProgress(null) }` so the
   * card unmounts after the stream completes. Tests that need to assert
   * the terminal "Finalizing CSV…" frame in the DOM should leave this
   * `false` — the unmount path is exercised separately.
   */
  clearOnFinish = false,
}: {
  streamFactory: () => AsyncGenerator<StreamAllValidEvent>;
  clearOnFinish?: boolean;
}) {
  const [progress, setProgress] = useState<AllValidProgress | null>(null);

  async function start() {
    setProgress({
      processed: 0,
      total: 0,
      phase: "starting",
      rate: 0,
      etaSeconds: null,
    });
    try {
      for await (const evt of streamFactory()) {
        // Use `flushSync` so each event renders distinctly instead of
        // React batching consecutive events (e.g. last `chunk` + `done`)
        // into a single render — that batching would hide intermediate
        // states from a step-by-step integration test even though the
        // rendered admin page sees the same final result.
        if (evt.type === "meta") {
          flushSync(() =>
            setProgress({
              processed: 0,
              total: evt.total,
              phase: "fetching",
              rate: 0,
              etaSeconds: null,
            }),
          );
        } else if (evt.type === "chunk") {
          flushSync(() =>
            setProgress({
              processed: evt.processed,
              total: evt.total,
              phase: "fetching",
              // Fixed rate/ETA so assertions are deterministic — the rate
              // smoothing logic itself is covered by AllValidProgressCard's
              // unit tests.
              rate: 100,
              etaSeconds: Math.max(0, Math.round((evt.total - evt.processed) / 100)),
            }),
          );
        } else if (evt.type === "done") {
          flushSync(() =>
            setProgress((p) =>
              p
                ? {
                    ...p,
                    processed: evt.rowCount,
                    phase: "finalizing",
                    etaSeconds: 0,
                  }
                : p,
            ),
          );
        }
      }
    } finally {
      if (clearOnFinish) setProgress(null);
    }
  }

  return (
    <div>
      <button type="button" onClick={start}>
        Export all valid
      </button>
      {progress && <AllValidProgressCard progress={progress} />}
    </div>
  );
}

// ---------- tests ----------

describe("admin streaming export — integration: events → progress card", () => {
  it("renders progress card phases as meta → chunk → chunk → done events arrive", async () => {
    const user = userEvent.setup();
    const ctl = makeControllableStream({
      total: 4,
      pages: [
        [makeRow("a"), makeRow("b")],
        [makeRow("c"), makeRow("d")],
      ],
    });

    render(<StreamingExportHarness streamFactory={() => ctl.stream} />);

    // ── Phase 0: nothing rendered before the click ──────────────────────
    expect(screen.queryByRole("progressbar")).toBeNull();

    // ── Phase 1: click → "starting" snapshot rendered synchronously ────
    await user.click(screen.getByRole("button", { name: /export all valid/i }));
    const card = await screen.findByRole("status");
    expect(within(card).getByText("Preparing export…")).toBeInTheDocument();
    // Starting phase now shows a skeleton shimmer instead of the
    // progressbar, until the first meta event arrives.
    expect(within(card).getByTestId("all-valid-skeleton")).toBeInTheDocument();
    expect(within(card).queryByRole("progressbar")).toBeNull();
    expect(within(card).queryByTestId("all-valid-rate-eta")).toBeNull();

    // ── Phase 2: resolve count → meta event → "fetching" with total ────
    ctl.resolveCount();
    await waitFor(() => {
      expect(within(card).getByText("Streaming completed responses")).toBeInTheDocument();
    });
    const bar1 = within(card).getByRole("progressbar");
    expect(bar1.getAttribute("aria-valuemax")).toBe("4");
    expect(bar1.getAttribute("aria-valuenow")).toBe("0");
    expect(within(card).getByText(/0 \/ 4/)).toBeInTheDocument();
    expect(within(card).getByText(/· 0%/)).toBeInTheDocument();

    // ── Phase 3: resolve page 0 → first chunk → processed = 2 (50%) ────
    ctl.resolvePage(0);
    await waitFor(() => {
      expect(within(card).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("2");
    });
    expect(within(card).getByText(/2 \/ 4/)).toBeInTheDocument();
    expect(within(card).getByText(/· 50%/)).toBeInTheDocument();
    // Rate/ETA row appears once we're in the fetching phase with samples.
    expect(within(card).getByTestId("all-valid-rate-eta")).toBeInTheDocument();
    expect(within(card).getByText("100 rows/s")).toBeInTheDocument();

    // ── Phase 4: resolve page 1 → second chunk → processed = 4 (100%),
    // then the impl fetches an empty page 2 and emits `done`, switching
    // the card to "Finalizing CSV…". Wait for the terminal label.
    ctl.resolvePage(1);
    await waitFor(() => {
      expect(within(card).getByText("Finalizing CSV…")).toBeInTheDocument();
    });
    const bar3 = within(card).getByRole("progressbar");
    expect(bar3.getAttribute("aria-valuenow")).toBe("4");
    expect(within(card).getByText(/4 \/ 4/)).toBeInTheDocument();
    expect(within(card).getByText(/· 100%/)).toBeInTheDocument();
    expect(within(card).queryByTestId("all-valid-rate-eta")).toBeNull();

    // (Card unmount on the harness's `finally` is exercised by the next
    // test — keeping it mounted here lets us assert the terminal frame
    // without racing the async cleanup.)
  });

  it("clears the progress card when the export finishes (harness `finally` path)", async () => {
    const user = userEvent.setup();
    const ctl = makeControllableStream({
      total: 2,
      pages: [[makeRow("a"), makeRow("b")]],
    });
    render(<StreamingExportHarness streamFactory={() => ctl.stream} clearOnFinish />);
    await user.click(screen.getByRole("button", { name: /export all valid/i }));
    await screen.findByRole("status");
    ctl.resolveCount();
    ctl.resolvePage(0);
    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull();
    });
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("aria-valuenow advances monotonically across multiple chunks", async () => {
    const user = userEvent.setup();
    const ctl = makeControllableStream({
      total: 6,
      pages: [
        [makeRow("a"), makeRow("b")],
        [makeRow("c"), makeRow("d")],
        [makeRow("e"), makeRow("f")],
      ],
    });
    render(<StreamingExportHarness streamFactory={() => ctl.stream} />);
    await user.click(screen.getByRole("button", { name: /export all valid/i }));
    const card = await screen.findByRole("status");

    ctl.resolveCount();
    await waitFor(() => {
      expect(within(card).getByRole("progressbar").getAttribute("aria-valuemax")).toBe("6");
    });

    const observed: number[] = [];
    const expectedAfter = [2, 4, 6];
    for (let i = 0; i < 3; i += 1) {
      ctl.resolvePage(i);
      const want = String(expectedAfter[i]);
      await waitFor(() => {
        expect(within(card).getByRole("progressbar").getAttribute("aria-valuenow")).toBe(want);
      });
      observed.push(expectedAfter[i]);
    }
    // Each chunk strictly increases processed; the final value is `total`.
    for (let i = 1; i < observed.length; i += 1) {
      expect(observed[i]).toBeGreaterThan(observed[i - 1]);
    }
    expect(observed[observed.length - 1]).toBe(6);
  });
});
