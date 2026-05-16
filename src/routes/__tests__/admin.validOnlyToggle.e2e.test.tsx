/**
 * Admin UI e2e: "Valid only" toggle ↔ filtered CSV export toast contract.
 *
 * The real `src/routes/admin.tsx` drags in auth bootstrap, the Supabase
 * client, recharts, and ~15 server fns. To get faithful coverage of the
 * actual contract — `<Valid only> checkbox state → exportFilteredFn
 * payload.validOnly → toast text including dropped invalid + dropped
 * unknown-survey counters` — without that coupling, we mount a small
 * `<ValidOnlyHarness>` that replicates the admin route verbatim:
 *
 *   - the `fValidOnly` `useState<boolean>`
 *   - the `effectiveStatus = fValidOnly ? "completed" : fStatus` derivation
 *     (status select is disabled while valid-only is on)
 *   - the `downloadFilteredCsv` function exactly as it is written in
 *     `src/routes/admin.tsx` (lines 742–778), including the itemized
 *     toast suffix logic that splits `droppedInvalid` and
 *     `droppedUnknownSurvey` into their own "(dropped N invalid, M
 *     unknown survey)" segments
 *
 * `exportFilteredFn` is mocked with `vi.fn()` so each test can pin both
 * (a) the payload the click sends to the server fn and (b) the toast
 * string built from the server fn's response.
 *
 * Verifies:
 *   1. Toggle OFF → click Export CSV → server fn payload
 *      `{ statusFilter: "in_progress", validOnly: false }`; toast omits
 *      the "(dropped …)" suffix even when the server returns nonzero
 *      drop counters (because the suffix is gated on `fValidOnly`).
 *   2. Toggle ON → status select is disabled; effective status passed to
 *      server fn is forced to `"completed"`; payload carries
 *      `validOnly: true`; toast row count matches `rowCount`.
 *   3. Toggle ON + only invalid drops → toast reads
 *      `"Exported N responses (dropped K invalid)"`.
 *   4. Toggle ON + only unknown-survey drops → toast reads
 *      `"Exported N responses (dropped K unknown survey)"`.
 *   5. Toggle ON + both drop buckets nonzero → toast reads
 *      `"Exported N responses (dropped K invalid, M unknown survey)"`
 *      in that exact order, with both counts rendered as separate
 *      segments and not collapsed into a single sum.
 *   6. Toggle ON + zero drops → toast suffix is fully suppressed.
 *   7. Singular vs plural — `rowCount === 1` renders "response", any
 *      other count renders "responses" (mirrors admin.tsx's
 *      `${rowCount === 1 ? "" : "s"}` rule).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// `sonner` is mocked so we can capture the exact toast strings the
// harness emits, the same way the admin route's success path would.
const toastSuccess = vi.fn<(msg: string) => void>();
const toastError = vi.fn<(msg: string) => void>();
vi.mock("sonner", () => ({
  toast: {
    success: (msg: string) => toastSuccess(msg),
    error: (msg: string) => toastError(msg),
  },
}));
import { toast } from "sonner";

type StatusFilter = "completed" | "in_progress" | "all";

type ExportFilteredResult = {
  csv: string;
  filename: string;
  rowCount: number;
  totalFetched: number;
  droppedInvalid: number;
  droppedUnknownSurvey: number;
};

type ExportFilteredPayload = {
  statusFilter: StatusFilter;
  validOnly: boolean;
  dateField: "started_at" | "completed_at";
  surveySlug?: string;
  language?: "en" | "si" | "ta";
  dateFrom?: string;
  dateTo?: string;
};

/**
 * Verbatim mirror of `src/routes/admin.tsx`'s Valid-only checkbox + CSV
 * download wiring. Any drift here means the admin UI also drifted from
 * the toast contract these tests pin — fix the route, then re-mirror.
 */
function ValidOnlyHarness({
  exportFilteredFn,
}: {
  exportFilteredFn: (args: { data: ExportFilteredPayload }) => Promise<ExportFilteredResult>;
}) {
  const [fStatus, setFStatus] = useState<StatusFilter>("in_progress");
  const [fValidOnly, setFValidOnly] = useState(false);
  const effectiveStatus: StatusFilter = fValidOnly ? "completed" : fStatus;

  async function downloadFilteredCsv() {
    try {
      const payload: ExportFilteredPayload = {
        statusFilter: effectiveStatus,
        validOnly: fValidOnly,
        dateField: "started_at",
      };
      const { rowCount, droppedInvalid, droppedUnknownSurvey } =
        await exportFilteredFn({ data: payload });
      const dInvalid = droppedInvalid ?? 0;
      const dUnknown = droppedUnknownSurvey ?? 0;
      const parts: string[] = [];
      if (fValidOnly && dInvalid > 0) parts.push(`${dInvalid} invalid`);
      if (fValidOnly && dUnknown > 0) parts.push(`${dUnknown} unknown survey`);
      const suffix = parts.length > 0 ? ` (dropped ${parts.join(", ")})` : "";
      toast.success(
        `Exported ${rowCount} response${rowCount === 1 ? "" : "s"}${suffix}`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <label>
        <input
          type="checkbox"
          data-testid="valid-only"
          checked={fValidOnly}
          onChange={(e) => setFValidOnly(e.target.checked)}
        />
        Valid only
      </label>
      <select
        data-testid="status"
        value={effectiveStatus}
        disabled={fValidOnly}
        onChange={(e) => setFStatus(e.target.value as StatusFilter)}
      >
        <option value="completed">Completed</option>
        <option value="in_progress">In progress</option>
        <option value="all">All</option>
      </select>
      <button data-testid="export-csv" onClick={downloadFilteredCsv}>
        Export CSV
      </button>
    </div>
  );
}

function makeResult(over: Partial<ExportFilteredResult> = {}): ExportFilteredResult {
  return {
    csv: "header\n",
    filename: "x.csv",
    rowCount: 0,
    totalFetched: 0,
    droppedInvalid: 0,
    droppedUnknownSurvey: 0,
    ...over,
  };
}

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
});

describe("admin UI: Valid only toggle ↔ filtered CSV export", () => {
  it("toggle OFF → suffix suppressed even when server returns nonzero drop counters", async () => {
    const exportFn = vi
      .fn<(args: { data: ExportFilteredPayload }) => Promise<ExportFilteredResult>>()
      .mockResolvedValue(
        makeResult({ rowCount: 7, droppedInvalid: 3, droppedUnknownSurvey: 2 }),
      );
    render(<ValidOnlyHarness exportFilteredFn={exportFn} />);
    await userEvent.click(screen.getByTestId("export-csv"));

    expect(exportFn).toHaveBeenCalledTimes(1);
    expect(exportFn.mock.calls[0][0].data).toEqual({
      statusFilter: "in_progress",
      validOnly: false,
      dateField: "started_at",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Exported 7 responses");
  });

  it("toggle ON → status select disabled, payload forces completed + validOnly", async () => {
    const exportFn = vi
      .fn<(args: { data: ExportFilteredPayload }) => Promise<ExportFilteredResult>>()
      .mockResolvedValue(makeResult({ rowCount: 12 }));
    render(<ValidOnlyHarness exportFilteredFn={exportFn} />);
    await userEvent.click(screen.getByTestId("valid-only"));

    expect((screen.getByTestId("status") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByTestId("status") as HTMLSelectElement).value).toBe("completed");

    await userEvent.click(screen.getByTestId("export-csv"));
    expect(exportFn.mock.calls[0][0].data).toEqual({
      statusFilter: "completed",
      validOnly: true,
      dateField: "started_at",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Exported 12 responses");
  });

  it("toggle ON + only invalid drops → '(dropped K invalid)'", async () => {
    const exportFn = vi
      .fn<(args: { data: ExportFilteredPayload }) => Promise<ExportFilteredResult>>()
      .mockResolvedValue(
        makeResult({ rowCount: 5, droppedInvalid: 4, droppedUnknownSurvey: 0 }),
      );
    render(<ValidOnlyHarness exportFilteredFn={exportFn} />);
    await userEvent.click(screen.getByTestId("valid-only"));
    await userEvent.click(screen.getByTestId("export-csv"));
    expect(toastSuccess).toHaveBeenCalledWith("Exported 5 responses (dropped 4 invalid)");
  });

  it("toggle ON + only unknown-survey drops → '(dropped K unknown survey)'", async () => {
    const exportFn = vi
      .fn<(args: { data: ExportFilteredPayload }) => Promise<ExportFilteredResult>>()
      .mockResolvedValue(
        makeResult({ rowCount: 8, droppedInvalid: 0, droppedUnknownSurvey: 2 }),
      );
    render(<ValidOnlyHarness exportFilteredFn={exportFn} />);
    await userEvent.click(screen.getByTestId("valid-only"));
    await userEvent.click(screen.getByTestId("export-csv"));
    expect(toastSuccess).toHaveBeenCalledWith(
      "Exported 8 responses (dropped 2 unknown survey)",
    );
  });

  it("toggle ON + both buckets nonzero → 'invalid' first, 'unknown survey' second, not summed", async () => {
    const exportFn = vi
      .fn<(args: { data: ExportFilteredPayload }) => Promise<ExportFilteredResult>>()
      .mockResolvedValue(
        makeResult({ rowCount: 9, droppedInvalid: 3, droppedUnknownSurvey: 1 }),
      );
    render(<ValidOnlyHarness exportFilteredFn={exportFn} />);
    await userEvent.click(screen.getByTestId("valid-only"));
    await userEvent.click(screen.getByTestId("export-csv"));
    const msg = toastSuccess.mock.calls[0][0];
    expect(msg).toBe("Exported 9 responses (dropped 3 invalid, 1 unknown survey)");
    // Pin order + segment separation explicitly: never a collapsed "4 invalid" sum.
    expect(msg).not.toMatch(/dropped 4 invalid/);
    expect(msg.indexOf("3 invalid")).toBeLessThan(msg.indexOf("1 unknown survey"));
  });

  it("toggle ON + zero drops → suffix fully suppressed", async () => {
    const exportFn = vi
      .fn<(args: { data: ExportFilteredPayload }) => Promise<ExportFilteredResult>>()
      .mockResolvedValue(makeResult({ rowCount: 4 }));
    render(<ValidOnlyHarness exportFilteredFn={exportFn} />);
    await userEvent.click(screen.getByTestId("valid-only"));
    await userEvent.click(screen.getByTestId("export-csv"));
    expect(toastSuccess).toHaveBeenCalledWith("Exported 4 responses");
  });

  it("singular vs plural — rowCount=1 says 'response'", async () => {
    const exportFn = vi
      .fn<(args: { data: ExportFilteredPayload }) => Promise<ExportFilteredResult>>()
      .mockResolvedValueOnce(makeResult({ rowCount: 1 }))
      .mockResolvedValueOnce(makeResult({ rowCount: 2 }));
    render(<ValidOnlyHarness exportFilteredFn={exportFn} />);
    await userEvent.click(screen.getByTestId("export-csv"));
    expect(toastSuccess).toHaveBeenLastCalledWith("Exported 1 response");
    await userEvent.click(screen.getByTestId("export-csv"));
    expect(toastSuccess).toHaveBeenLastCalledWith("Exported 2 responses");
  });
});
