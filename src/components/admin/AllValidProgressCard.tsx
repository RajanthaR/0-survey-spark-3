import { formatBytes, formatEta, formatRate } from "@/lib/progress-format";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Live progress shape pushed by the streaming all-valid CSV export. See
 * `streamAllValidCsvImpl` for the wire protocol that drives these fields.
 *
 * `phase: "cancelled"` is a terminal client-side state (the server
 * generator never emits it) — the route flips into it as soon as the
 * admin confirms the cancel dialog so the card reads "Export cancelled
 * — N rows fetched, no file saved" instead of vanishing silently.
 *
 * `phase: "paused"` is also client-only — the for-await loop holds at a
 * pause gate so the server stream backpressures while the admin is
 * paused. UI shows it next to a Resume button.
 */
export type AllValidProgress = {
  processed: number;
  total: number;
  phase: "starting" | "restored" | "resuming" | "fetching" | "paused" | "finalizing" | "cancelled";
  /** Smoothed rows/second; 0 until we have a sample. */
  rate: number;
  /** Estimated seconds remaining; null until rate + total are known. */
  etaSeconds: number | null;
  /** Bytes streamed so far (uncompressed CSV body). Drives the "remaining
   *  file size" estimate; 0 until the first chunk has arrived. */
  bytesProcessed?: number;
  /** Recent rows/sec samples (oldest → newest), capped to ~30 points so
   *  the inline sparkline can render without unbounded growth. */
  rateHistory?: number[];
  /** When the run was kicked off via "Resume from last page", the page
   *  number the new stream is starting from (i.e. `lastPage + 1`). Used
   *  by the progress card to render "Resuming from page N…" so admins
   *  can see the run actually restarted from where it left off. Also
   *  carried into `phase: "restored"` snapshots emitted on mount when a
   *  failed-run buffer is rehydrated from localStorage so the card can
   *  show the page the resume would continue from. */
  resumeFromPage?: number;
  /** Set when the post-assembly continuity validator rejects the run.
   *  Renders a prominent warning block in the card with the failure
   *  reason, the offending chunk/page (if localizable), and a Retry
   *  CTA wired to the parent's `onRetryContinuity` handler. */
  continuityError?: {
    reason: string;
    chunkIndex?: number;
    page?: number;
    suggestion: string;
  };
  /** Live integrity report rolled forward as chunks land. Populated by
   *  the streamer in `src/routes/admin.tsx` so the admin can verify
   *  page-level continuity before the file is downloaded. */
  integrity?: {
    /** Count of distinct page indexes appended to the buffer this run
     *  (excludes pages skipped by the resume de-dup layer). */
    pagesReceived: number;
    /** Lowest page index seen in this run; null until the first chunk. */
    minPage: number | null;
    /** Highest page index seen in this run; null until the first chunk. */
    maxPage: number | null;
    /** Count of chunks whose per-chunk CRC32 matched the server's hash. */
    continuityChecksPassed: number;
    /** Count of chunks whose per-chunk CRC32 did NOT match. */
    chunkCrcMismatches: number;
    /** Count of `chunk` events dropped by the resume de-dup layer. */
    duplicatesDropped: number;
    /** Page indexes missing from the contiguous `[minPage, maxPage]`
     *  window — i.e. detected gaps in the page sequence. Capped to the
     *  first 10 entries so the card stays compact. */
    gaps: number[];
    /** End-of-file checksum status. `pending` until the server emits
     *  the `checksum` envelope; `ok` after the client matches it; `fail`
     *  on mismatch (also drives `continuityError`). */
    checksum: "pending" | "ok" | "fail";
  };
};

/**
 * Progress card rendered inside the Recent-responses card while the
 * streaming export runs. Pure presentational — receives the latest
 * progress snapshot as a prop so it can be exercised from unit tests
 * without spinning up the full admin page.
 */
export function AllValidProgressCard({
  progress,
  paused,
  onPause,
  onResume,
  onDismiss,
  onRetryContinuity,
  requestId,
}: {
  progress: AllValidProgress;
  /** Mirrors `progress.phase === "paused"` but lets the parent toggle
   *  the button label even on the very first paint before the next
   *  progress snapshot has flowed back through. */
  paused?: boolean;
  /** Pause/Resume the streaming run. Both are no-ops when undefined,
   *  which keeps existing call sites and tests working unchanged. */
  onPause?: () => void;
  onResume?: () => void;
  /** Optional dismiss handler — only wired when the card is in its
   *  terminal "cancelled" state so admins can clear it from the UI. */
  onDismiss?: () => void;
  /** Wired by the parent to `resumeAllValidCsvFromLastPage` so the
   *  continuity-error warning's Retry CTA can re-issue the export from
   *  the last successfully appended page. No-op when omitted. */
  onRetryContinuity?: () => void;
  /** Server-assigned correlation id for the active (or resumable) run.
   *  Rendered as a small monospace badge in the card header so the
   *  admin can copy it and grep server logs in real time, regardless
   *  of phase (starting, fetching, paused, finalizing, restored,
   *  resuming, cancelled). Hidden when null/empty. */
  requestId?: string | null;
}) {
  const cancelled = progress.phase === "cancelled";
  const isPaused = paused || progress.phase === "paused";
  const isStarting = progress.phase === "starting";
  const isResuming = progress.phase === "resuming";
  const isRestored = progress.phase === "restored";
  // The resuming/restored states share the same "no live samples yet"
  // treatment as the initial starting state — skeletons + suppressed
  // rate/ETA — so the card visibly resets while the new stream spins up
  // (or, for `restored`, while it waits for the admin to click Resume).
  const isPreparing = isStarting || isResuming || isRestored;
  const pct = progress.total > 0 ? Math.min(100, (progress.processed / progress.total) * 100) : 0;

  // Estimated remaining file size: project the average bytes-per-row
  // observed so far across the rows still to fetch. Only meaningful
  // once we've streamed >0 rows AND know the total — otherwise omit.
  const remainingRows = Math.max(0, progress.total - progress.processed);
  const bytesPerRow =
    progress.bytesProcessed && progress.processed > 0
      ? progress.bytesProcessed / progress.processed
      : 0;
  const remainingBytes = bytesPerRow > 0 && progress.total > 0 ? remainingRows * bytesPerRow : 0;

  const continuityError = progress.continuityError;
  const hasContinuityError = !!continuityError;

  return (
    <div
      id="all-valid-progress"
      className={`mb-3 rounded-lg border p-3 ${
        hasContinuityError
          ? "border-destructive/60 bg-destructive/5"
          : cancelled
            ? "border-destructive/40 bg-destructive/5"
            : isPaused
              ? "border-amber-500/40 bg-amber-500/5"
              : "bg-muted/40"
      }`}
      role="status"
      aria-live="polite"
      data-testid="all-valid-progress-card"
      data-phase={progress.phase}
      data-continuity-error={hasContinuityError ? "1" : undefined}
    >
      {hasContinuityError && (
        <div
          data-testid="all-valid-continuity-error"
          role="alert"
          className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs"
        >
          <div className="font-medium text-destructive">CSV continuity check failed</div>
          <div className="mt-1 text-muted-foreground">
            <span className="font-medium text-foreground">Reason:</span> {continuityError.reason}
          </div>
          {(continuityError.page != null || continuityError.chunkIndex != null) && (
            <div
              className="mt-0.5 text-muted-foreground"
              data-testid="all-valid-continuity-locator"
            >
              <span className="font-medium text-foreground">Where:</span>{" "}
              {continuityError.page != null
                ? `page ${continuityError.page.toLocaleString()}`
                : `chunk #${continuityError.chunkIndex}`}
              {continuityError.page != null && continuityError.chunkIndex != null && (
                <> (chunk #{continuityError.chunkIndex})</>
              )}
            </div>
          )}
          <div className="mt-1 text-muted-foreground">
            <span className="font-medium text-foreground">Suggested:</span>{" "}
            {continuityError.suggestion}
          </div>
          {onRetryContinuity && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={onRetryContinuity}
                className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/20"
                data-testid="all-valid-continuity-retry"
              >
                Retry from last successful page
              </button>
            </div>
          )}
        </div>
      )}
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span
          className={`font-medium ${
            cancelled ? "text-destructive" : isPaused ? "text-amber-700 dark:text-amber-400" : ""
          }`}
        >
          {cancelled
            ? "Export cancelled"
            : isRestored
              ? "Restored from refresh"
              : isResuming
                ? `Resuming from page ${progress.resumeFromPage ?? "?"}…`
                : isStarting
                  ? "Preparing export…"
                  : isPaused
                    ? "Paused"
                    : progress.phase === "finalizing"
                      ? "Finalizing CSV…"
                      : "Streaming completed responses"}
        </span>
        {requestId && (
          <span
            className="inline-flex max-w-[40%] items-center gap-1 truncate rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            data-testid="all-valid-progress-request-id"
            title={`requestId=${requestId} — copy to correlate with server logs`}
          >
            <span className="text-foreground/70">req</span>
            <span className="truncate">{requestId}</span>
          </span>
        )}
        <span className="tabular-nums text-muted-foreground">
          {cancelled ? (
            <>
              {progress.processed.toLocaleString()} row
              {progress.processed === 1 ? "" : "s"} fetched
              {progress.total > 0 && <> / {progress.total.toLocaleString()}</>}
              {" · no file saved"}
            </>
          ) : isRestored ? (
            <span data-testid="all-valid-restored-hint">
              {progress.processed.toLocaleString()} row
              {progress.processed === 1 ? "" : "s"} buffered
              {progress.resumeFromPage != null && (
                <> · resume continues from page {progress.resumeFromPage.toLocaleString()}</>
              )}{" "}
              · rate/ETA will recompute on resume
            </span>
          ) : isResuming ? (
            <span data-testid="all-valid-resuming-hint">
              {progress.processed.toLocaleString()} row
              {progress.processed === 1 ? "" : "s"} across{" "}
              {(progress.resumeFromPage ?? 0).toLocaleString()} page
              {progress.resumeFromPage === 1 ? "" : "s"} reused · recalculating rate…
            </span>
          ) : isStarting ? (
            <span data-testid="all-valid-preparing-hint">Contacting server…</span>
          ) : (
            <>
              {progress.total > 0
                ? `${progress.processed.toLocaleString()} / ${progress.total.toLocaleString()}`
                : `${progress.processed.toLocaleString()}`}
              {progress.total > 0 && <> · {Math.round(pct)}%</>}
            </>
          )}
        </span>
      </div>

      {isPreparing ? (
        <div
          data-testid={
            isRestored
              ? "all-valid-restored-skeleton"
              : isResuming
                ? "all-valid-resuming-skeleton"
                : "all-valid-skeleton"
          }
          className="space-y-1.5"
        >
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ) : (
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total || 100}
          aria-valuenow={progress.processed}
          aria-label="All-valid CSV export progress"
        >
          <div
            className={`h-full rounded-full ${
              cancelled
                ? "bg-destructive/60"
                : isPaused
                  ? "bg-amber-500/70"
                  : `bg-primary ${
                      progress.total === 0 || progress.phase !== "fetching"
                        ? "animate-pulse"
                        : "transition-[width] duration-700 ease-out"
                    }`
            }`}
            style={{
              width: progress.total > 0 ? `${pct}%` : "100%",
            }}
          />
        </div>
      )}

      {(progress.phase === "fetching" || isPaused) && progress.total > 0 && (
        <div
          data-testid="all-valid-rate-eta"
          className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground"
        >
          <span>
            {isPaused
              ? "Paused — server stream held"
              : progress.rate > 0
                ? `${formatRate(progress.rate)} rows/s`
                : "Measuring rate…"}
          </span>
          <span>
            {isPaused
              ? "ETA paused"
              : progress.etaSeconds != null
                ? `~${formatEta(progress.etaSeconds)} remaining`
                : "ETA pending"}
          </span>
        </div>
      )}

      {!cancelled && !isPreparing && progress.total > 0 && (
        <div
          data-testid="all-valid-remaining-size"
          className="mt-1 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground"
        >
          <span>
            {remainingRows.toLocaleString()} row
            {remainingRows === 1 ? "" : "s"} remaining
          </span>
          <span>{remainingBytes > 0 ? `~${formatBytes(remainingBytes)} left` : "Sizing…"}</span>
        </div>
      )}

      {!cancelled && !isPreparing && (progress.rateHistory?.length ?? 0) > 1 && (
        <RateSparkline history={progress.rateHistory ?? []} paused={isPaused} />
      )}

      {(onPause || onResume) && !cancelled && !isPreparing && progress.phase !== "finalizing" && (
        <div className="mt-2 flex justify-end">
          {isPaused ? (
            <button
              type="button"
              onClick={onResume}
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
              data-testid="all-valid-resume"
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              className="rounded-md border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              data-testid="all-valid-pause"
            >
              Pause
            </button>
          )}
        </div>
      )}

      {cancelled && onDismiss && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            data-testid="all-valid-cancelled-dismiss"
          >
            Dismiss
          </button>
        </div>
      )}

      {progress.integrity && <IntegrityReport integrity={progress.integrity} />}
    </div>
  );
}

/**
 * Compact CSV continuity integrity report. Renders a small panel below
 * the rate/ETA row showing pages received, continuity checks passed,
 * any detected page gaps, and the end-of-file checksum status — so the
 * admin can verify the assembled file is valid before downloading.
 */
function IntegrityReport({ integrity }: { integrity: NonNullable<AllValidProgress["integrity"]> }) {
  const {
    pagesReceived,
    minPage,
    maxPage,
    continuityChecksPassed,
    chunkCrcMismatches,
    duplicatesDropped,
    gaps,
    checksum,
  } = integrity;
  const hasGaps = gaps.length > 0;
  const hasMismatch = chunkCrcMismatches > 0 || checksum === "fail" || hasGaps;
  const checksumLabel =
    checksum === "ok" ? "verified" : checksum === "fail" ? "MISMATCH" : "pending";
  const checksumTone =
    checksum === "ok"
      ? "text-foreground"
      : checksum === "fail"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <div
      data-testid="all-valid-integrity-report"
      data-integrity-status={hasMismatch ? "warn" : "ok"}
      className={`mt-2 rounded-md border p-2 text-[11px] ${
        hasMismatch ? "border-destructive/40 bg-destructive/5" : "border-border/60 bg-muted/30"
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Integrity report
        </span>
        <span
          className={`text-[10px] font-medium uppercase tracking-wide ${
            hasMismatch ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
          }`}
          data-testid="all-valid-integrity-status"
        >
          {hasMismatch ? "issues detected" : "all checks passing"}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
        <dt className="text-muted-foreground">Pages received</dt>
        <dd className="text-right text-foreground" data-testid="all-valid-integrity-pages">
          {pagesReceived.toLocaleString()}
          {minPage != null && maxPage != null && (
            <span className="text-muted-foreground">
              {" "}
              (range {minPage}–{maxPage})
            </span>
          )}
        </dd>
        <dt className="text-muted-foreground">Continuity checks passed</dt>
        <dd className="text-right text-foreground" data-testid="all-valid-integrity-checks">
          {continuityChecksPassed.toLocaleString()}
          {chunkCrcMismatches > 0 && (
            <span className="text-destructive">
              {" "}
              · {chunkCrcMismatches.toLocaleString()} mismatch
              {chunkCrcMismatches === 1 ? "" : "es"}
            </span>
          )}
        </dd>
        {duplicatesDropped > 0 && (
          <>
            <dt className="text-muted-foreground">Duplicates dropped</dt>
            <dd className="text-right text-foreground" data-testid="all-valid-integrity-duplicates">
              {duplicatesDropped.toLocaleString()}
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">Detected gaps</dt>
        <dd
          className={`text-right ${hasGaps ? "text-destructive" : "text-foreground"}`}
          data-testid="all-valid-integrity-gaps"
        >
          {hasGaps
            ? `${gaps.length} (page${gaps.length === 1 ? "" : "s"} ${gaps.slice(0, 5).join(", ")}${gaps.length > 5 ? "…" : ""})`
            : "none"}
        </dd>
        <dt className="text-muted-foreground">End-of-file checksum</dt>
        <dd className={`text-right ${checksumTone}`} data-testid="all-valid-integrity-checksum">
          {checksumLabel}
        </dd>
      </dl>
    </div>
  );
}

/**
 * Inline SVG sparkline of recent rows/sec samples. Dependency-free so
 * we don't pull a chart library in just for this readout. Y-axis auto-
 * scales to the max sample so the line fills the available height.
 */
function RateSparkline({ history, paused }: { history: number[]; paused: boolean }) {
  const W = 160;
  const H = 28;
  const max = Math.max(...history, 1);
  const min = 0;
  const stepX = history.length > 1 ? W / (history.length - 1) : W;
  const points = history
    .map((v, i) => {
      const x = i * stepX;
      const y = H - ((v - min) / (max - min || 1)) * (H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = history[history.length - 1] ?? 0;
  return (
    <div
      data-testid="all-valid-rate-sparkline"
      className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"
    >
      <span className="shrink-0 uppercase tracking-wide">rows/s</span>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="overflow-visible"
        aria-hidden="true"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeLinejoin="round"
          strokeLinecap="round"
          className={paused ? "text-amber-500" : "text-primary"}
          points={points}
        />
      </svg>
      <span className="shrink-0 tabular-nums">
        peak {formatRate(max)} · now {formatRate(last)}
      </span>
    </div>
  );
}
