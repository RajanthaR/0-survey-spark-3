/**
 * Verifies the admin streaming-export progress card updates correctly as
 * the parent feeds it successive `AllValidProgress` snapshots — the same
 * snapshots `streamAllValidCsvImpl`'s meta → chunk → done events produce.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AllValidProgressCard,
  type AllValidProgress,
} from "@/components/admin/AllValidProgressCard";

function progressbar() {
  return screen.getByRole("progressbar");
}

describe("AllValidProgressCard — UI updates", () => {
  it("starting phase: shows 'Preparing export…' + skeleton shimmer (no rate/ETA, no progressbar)", () => {
    const p: AllValidProgress = {
      processed: 0,
      total: 0,
      phase: "starting",
      rate: 0,
      etaSeconds: null,
    };
    render(<AllValidProgressCard progress={p} />);
    expect(screen.getByText("Preparing export…")).toBeInTheDocument();
    expect(screen.queryByTestId("all-valid-rate-eta")).toBeNull();
    // Skeleton replaces the progressbar before the first chunk arrives,
    // making the "preparing" state visually distinct.
    expect(screen.getByTestId("all-valid-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("all-valid-preparing-hint")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });


  it("fetching meta snapshot: shows total, 0% progress, 'Measuring rate…' / 'ETA pending'", () => {
    const p: AllValidProgress = {
      processed: 0,
      total: 1000,
      phase: "fetching",
      rate: 0,
      etaSeconds: null,
    };
    render(<AllValidProgressCard progress={p} />);
    expect(screen.getByText("Streaming completed responses")).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 1,000/)).toBeInTheDocument();
    expect(screen.getByText(/· 0%/)).toBeInTheDocument();
    expect(progressbar().getAttribute("aria-valuemax")).toBe("1000");
    expect(progressbar().getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByText("Measuring rate…")).toBeInTheDocument();
    expect(screen.getByText("ETA pending")).toBeInTheDocument();
  });

  it("mid-stream chunk snapshot: percentage, rate, and human ETA all reflect inputs", () => {
    const p: AllValidProgress = {
      processed: 250,
      total: 1000,
      phase: "fetching",
      rate: 125, // rows/s
      etaSeconds: 200, // remaining = 750 / 125 ≈ 200s → "3m 20s"
    };
    render(<AllValidProgressCard progress={p} />);
    expect(screen.getByText(/250 \/ 1,000/)).toBeInTheDocument();
    expect(screen.getByText(/· 25%/)).toBeInTheDocument();
    expect(progressbar().getAttribute("aria-valuenow")).toBe("250");
    expect(screen.getByText("125 rows/s")).toBeInTheDocument();
    expect(screen.getByText("~3m 20s remaining")).toBeInTheDocument();
  });

  it("rate ≥ 1000 renders in 'k' units", () => {
    const p: AllValidProgress = {
      processed: 8000,
      total: 10_000,
      phase: "fetching",
      rate: 1500,
      etaSeconds: 1.3,
    };
    render(<AllValidProgressCard progress={p} />);
    expect(screen.getByText("1.5k rows/s")).toBeInTheDocument();
    expect(screen.getByText("~1s remaining")).toBeInTheDocument();
  });

  it("finalizing snapshot: hides rate/ETA row, switches to 'Finalizing CSV…' label", () => {
    const p: AllValidProgress = {
      processed: 1000,
      total: 1000,
      phase: "finalizing",
      rate: 250,
      etaSeconds: 0,
    };
    render(<AllValidProgressCard progress={p} />);
    expect(screen.getByText("Finalizing CSV…")).toBeInTheDocument();
    // Rate/ETA row only renders during the fetching phase.
    expect(screen.queryByTestId("all-valid-rate-eta")).toBeNull();
    expect(screen.getByText(/1,000 \/ 1,000/)).toBeInTheDocument();
    expect(screen.getByText(/· 100%/)).toBeInTheDocument();
  });

  it("re-renders update aria-valuenow as successive snapshots arrive", () => {
    const base = { total: 100, phase: "fetching" as const, rate: 10, etaSeconds: 9 };
    const { rerender } = render(
      <AllValidProgressCard progress={{ ...base, processed: 10 }} />,
    );
    expect(progressbar().getAttribute("aria-valuenow")).toBe("10");
    rerender(<AllValidProgressCard progress={{ ...base, processed: 50 }} />);
    expect(progressbar().getAttribute("aria-valuenow")).toBe("50");
    rerender(<AllValidProgressCard progress={{ ...base, processed: 100 }} />);
    expect(progressbar().getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByText(/· 100%/)).toBeInTheDocument();
  });

  it("paused phase: shows Paused label, 'ETA paused', Resume button, and rate sparkline", () => {
    const p: AllValidProgress = {
      processed: 250,
      total: 1000,
      phase: "paused",
      rate: 100,
      etaSeconds: null,
      bytesProcessed: 50_000,
      rateHistory: [80, 90, 100, 110, 100],
    };
    const onResume = () => {};
    render(<AllValidProgressCard progress={p} onResume={onResume} onPause={() => {}} />);
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Paused — server stream held")).toBeInTheDocument();
    expect(screen.getByText("ETA paused")).toBeInTheDocument();
    expect(screen.getByTestId("all-valid-resume")).toBeInTheDocument();
    expect(screen.getByTestId("all-valid-rate-sparkline")).toBeInTheDocument();
    // Remaining-size hint surfaces once bytesProcessed > 0.
    expect(screen.getByTestId("all-valid-remaining-size")).toBeInTheDocument();
  });

  it("fetching with bytesProcessed: shows estimated remaining file size", () => {
    const p: AllValidProgress = {
      processed: 100,
      total: 1000,
      phase: "fetching",
      rate: 50,
      etaSeconds: 18,
      bytesProcessed: 102_400, // 1024 bytes/row → 900 * 1024 = 921,600 ≈ 900 KB
      rateHistory: [40, 50],
    };
    render(<AllValidProgressCard progress={p} />);
    const sizeRow = screen.getByTestId("all-valid-remaining-size");
    expect(sizeRow.textContent).toMatch(/900 row/);
    expect(sizeRow.textContent).toMatch(/KB left/);
  });
});
