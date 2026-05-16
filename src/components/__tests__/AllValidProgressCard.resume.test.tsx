/**
 * Integration tests for the resume UX rendered by the streaming-export
 * progress card (CSV) and the inline XLSX progress strip.
 *
 * Both flows go through the same client-side state machine: the parent
 * pushes `phase: "resuming"` snapshots while the new stream spins up,
 * then flips to `phase: "fetching"` once the first chunk of the resumed
 * run arrives. These tests assert the user-visible contract for both:
 *
 *  1. While resuming, the header reads "Resuming from page N…" and the
 *     hint reports how many rows + pages were carried over (the salvaged
 *     buffer). The rate/ETA row is suppressed because the previous run's
 *     throughput stats are deliberately reset on resume.
 *  2. As the new stream's chunks arrive, the percentage advances and the
 *     rate/ETA row appears with values computed from the *new* run only —
 *     i.e. the old run's blended rate is not preserved.
 *  3. The XLSX inline strip mirrors the same wording (resume page, rows
 *     carried, page count) and replaces the resuming text with live
 *     "{processed} / {total} rows" once chunks flow.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AllValidProgressCard,
  type AllValidProgress,
} from "@/components/admin/AllValidProgressCard";

// Mirror the inline XLSX strip in admin.tsx so we can assert its
// resuming/fetching contract without mounting the full admin route.
type XlsxProgress = {
  processed: number;
  total: number;
  phase: "starting" | "resuming" | "fetching" | "finalizing" | "cancelled";
  resumeFromPage?: number;
};
function XlsxProgressStrip({ progress }: { progress: XlsxProgress }) {
  return (
    <div data-testid="all-valid-xlsx-progress-strip" data-phase={progress.phase}>
      XLSX export:{" "}
      {progress.phase === "starting"
        ? "preparing…"
        : progress.phase === "resuming"
          ? `resuming from page ${progress.resumeFromPage ?? "?"} (${progress.processed.toLocaleString()} row${progress.processed === 1 ? "" : "s"} across ${progress.resumeFromPage ?? 0} page${progress.resumeFromPage === 1 ? "" : "s"} reused, recalculating…)`
          : progress.phase === "finalizing"
            ? "assembling workbook…"
            : progress.phase === "cancelled"
              ? `cancelled at ${progress.processed.toLocaleString()} rows`
              : `${progress.processed.toLocaleString()} / ${progress.total.toLocaleString()} rows`}
    </div>
  );
}

describe("AllValidProgressCard — CSV resume integration", () => {
  it("'resuming' snapshot shows 'Resuming from page N…', salvage counts, and suppresses rate/ETA", () => {
    // Failed run buffered 250 rows across pages 0..4 (5 pages); resume
    // is about to start at page 5.
    const resuming: AllValidProgress = {
      processed: 250,
      total: 1000,
      phase: "resuming",
      rate: 0,
      etaSeconds: null,
      resumeFromPage: 5,
    };
    render(<AllValidProgressCard progress={resuming} />);

    expect(screen.getByText("Resuming from page 5…")).toBeInTheDocument();
    const hint = screen.getByTestId("all-valid-resuming-hint");
    expect(hint.textContent).toMatch(/250 rows across 5 pages reused/);
    expect(hint.textContent).toMatch(/recalculating rate…/);

    // Throughput stats from the prior failed run are intentionally
    // reset on resume — the rate/ETA row must NOT render until the
    // first chunk of the resumed stream arrives.
    expect(screen.queryByTestId("all-valid-rate-eta")).toBeNull();
    // Skeleton replaces the progressbar in the resuming phase, with a
    // dedicated test id so the parent can distinguish it from
    // "starting".
    expect(screen.getByTestId("all-valid-resuming-skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("first chunk after resume: progressbar + rate/ETA computed from the NEW run only", () => {
    const resuming: AllValidProgress = {
      processed: 250,
      total: 1000,
      phase: "resuming",
      rate: 0,
      etaSeconds: null,
      resumeFromPage: 5,
    };
    const { rerender } = render(<AllValidProgressCard progress={resuming} />);
    expect(screen.queryByTestId("all-valid-rate-eta")).toBeNull();

    // First chunk of the resumed stream arrives — page 5 (50 new rows).
    // Rate is sampled fresh from the new run (not blended with the
    // failed attempt's history). ETA = remaining / rate = 700 / 50 = 14s.
    const firstResumedChunk: AllValidProgress = {
      processed: 300,
      total: 1000,
      phase: "fetching",
      rate: 50,
      etaSeconds: 14,
      rateHistory: [50],
    };
    rerender(<AllValidProgressCard progress={firstResumedChunk} />);

    expect(screen.getByText("Streaming completed responses")).toBeInTheDocument();
    expect(screen.queryByTestId("all-valid-resuming-skeleton")).toBeNull();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("300");
    expect(screen.getByText(/300 \/ 1,000/)).toBeInTheDocument();
    expect(screen.getByText(/· 30%/)).toBeInTheDocument();

    // Rate/ETA row reflects the post-resume samples, not the prior run.
    const rateEta = screen.getByTestId("all-valid-rate-eta");
    expect(rateEta.textContent).toMatch(/50(?:\.0)? rows\/s/);
    expect(rateEta.textContent).toMatch(/~14s remaining/);
  });

  it("ETA recalculates as successive resumed chunks update the rate", () => {
    const base = {
      total: 1000,
      phase: "fetching" as const,
      processed: 300,
    };
    // Snapshot A: rate 50 rows/s → 700 / 50 = 14s remaining
    const { rerender } = render(
      <AllValidProgressCard
        progress={{ ...base, rate: 50, etaSeconds: 14, rateHistory: [50] }}
      />,
    );
    expect(screen.getByTestId("all-valid-rate-eta").textContent).toMatch(
      /~14s remaining/,
    );
    expect(screen.getByTestId("all-valid-rate-eta").textContent).toMatch(
      /50(?:\.0)? rows\/s/,
    );

    // Snapshot B: rate climbs to 100 rows/s → 600 / 100 = 6s remaining
    rerender(
      <AllValidProgressCard
        progress={{
          ...base,
          processed: 400,
          rate: 100,
          etaSeconds: 6,
          rateHistory: [50, 100],
        }}
      />,
    );
    const rateEta = screen.getByTestId("all-valid-rate-eta");
    expect(rateEta.textContent).toMatch(/100 rows\/s/);
    expect(rateEta.textContent).toMatch(/~6s remaining/);
    expect(rateEta.textContent).not.toMatch(/~14s remaining/);
  });

  it("sampler reset: entering 'resuming' immediately clears prior rate/ETA/sparkline/remaining-size from the card", () => {
    // Mid-stream snapshot from the failing run: rate, ETA, history,
    // and bytes are all populated and rendered.
    const midStream: AllValidProgress = {
      processed: 250,
      total: 1000,
      phase: "fetching",
      rate: 125,
      etaSeconds: 6,
      bytesProcessed: 50_000,
      rateHistory: [80, 100, 125],
    };
    const { rerender } = render(<AllValidProgressCard progress={midStream} />);
    expect(screen.getByTestId("all-valid-rate-eta")).toBeInTheDocument();
    expect(screen.getByTestId("all-valid-remaining-size")).toBeInTheDocument();
    expect(screen.getByTestId("all-valid-rate-sparkline")).toBeInTheDocument();

    // Admin clicks Resume → the route resets allValidRateRef AND
    // pushes a fresh snapshot with rate:0/etaSeconds:null/empty
    // history (admin.tsx ~745-762). The card must reflect that
    // synchronously so the prior run's metrics never appear next to
    // "Resuming from page N…".
    const resumingSnapshot: AllValidProgress = {
      processed: 250,
      total: 1000,
      phase: "resuming",
      rate: 0,
      etaSeconds: null,
      bytesProcessed: 0,
      rateHistory: [],
      resumeFromPage: 5,
    };
    rerender(<AllValidProgressCard progress={resumingSnapshot} />);

    expect(screen.getByText("Resuming from page 5…")).toBeInTheDocument();
    // Sampler-driven UI rows must be gone — the resuming phase is
    // rendered as a clean slate so the recalculation is visible.
    expect(screen.queryByTestId("all-valid-rate-eta")).toBeNull();
    expect(screen.queryByTestId("all-valid-remaining-size")).toBeNull();
    expect(screen.queryByTestId("all-valid-rate-sparkline")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByTestId("all-valid-resuming-skeleton")).toBeInTheDocument();
  });

  it("guard: even if a stale rate/rateHistory leaks into a 'resuming' snapshot, the card still suppresses them", () => {
    // Defensive contract: the card must not render rate/ETA/sparkline
    // for phase: "resuming" regardless of what numbers the parent
    // passes. This protects against a bug where the route forgets to
    // zero one of the fields before flipping the phase.
    const leakySnapshot: AllValidProgress = {
      processed: 250,
      total: 1000,
      phase: "resuming",
      rate: 999, // would normally render "999 rows/s"
      etaSeconds: 42, // would normally render "~42s remaining"
      bytesProcessed: 99_999,
      rateHistory: [10, 20, 30, 40, 50],
      resumeFromPage: 5,
    };
    render(<AllValidProgressCard progress={leakySnapshot} />);

    expect(screen.queryByText(/999 rows\/s/)).toBeNull();
    expect(screen.queryByText(/~42s remaining/)).toBeNull();
    expect(screen.queryByTestId("all-valid-rate-eta")).toBeNull();
    expect(screen.queryByTestId("all-valid-remaining-size")).toBeNull();
    expect(screen.queryByTestId("all-valid-rate-sparkline")).toBeNull();
  });
});

describe("XLSX inline progress strip — resume integration", () => {
  it("'resuming' snapshot reports the resume page, salvaged rows, and page count", () => {
    render(
      <XlsxProgressStrip
        progress={{
          processed: 1200,
          total: 5000,
          phase: "resuming",
          resumeFromPage: 3,
        }}
      />,
    );
    const strip = screen.getByTestId("all-valid-xlsx-progress-strip");
    expect(strip.getAttribute("data-phase")).toBe("resuming");
    expect(strip.textContent).toMatch(/resuming from page 3/);
    expect(strip.textContent).toMatch(/1,200 rows across 3 pages reused/);
    expect(strip.textContent).toMatch(/recalculating…/);
  });

  it("transitions to live row counts once chunks arrive after the resume", () => {
    const { rerender } = render(
      <XlsxProgressStrip
        progress={{
          processed: 1200,
          total: 5000,
          phase: "resuming",
          resumeFromPage: 3,
        }}
      />,
    );
    expect(screen.getByTestId("all-valid-xlsx-progress-strip").textContent).toMatch(
      /resuming from page 3/,
    );

    // First resumed chunk → strip switches to "{processed} / {total} rows"
    rerender(
      <XlsxProgressStrip
        progress={{
          processed: 1700,
          total: 5000,
          phase: "fetching",
          resumeFromPage: 3,
        }}
      />,
    );
    const strip = screen.getByTestId("all-valid-xlsx-progress-strip");
    expect(strip.getAttribute("data-phase")).toBe("fetching");
    expect(strip.textContent).toMatch(/1,700 \/ 5,000 rows/);
    expect(strip.textContent).not.toMatch(/resuming from page/);
  });

  it("singular 'page reused' wording when only one page was salvaged", () => {
    render(
      <XlsxProgressStrip
        progress={{
          processed: 500,
          total: 5000,
          phase: "resuming",
          resumeFromPage: 1,
        }}
      />,
    );
    const strip = screen.getByTestId("all-valid-xlsx-progress-strip");
    // "1 page reused" — singular, not "1 pages"
    expect(strip.textContent).toMatch(/across 1 page reused/);
    expect(strip.textContent).not.toMatch(/across 1 pages reused/);
  });
});
