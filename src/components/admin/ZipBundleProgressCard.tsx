/**
 * Live progress shape pushed by the ZIP bundle export. Unlike the
 * streaming all-valid CSV (which yields per-chunk meta/chunk/done
 * events), the bundle export is a single server round-trip followed by
 * a synchronous client-side zip + download — so we can't show row
 * counts. We expose three named phases the operator can follow:
 *
 *   preparing  → the server is fetching + assembling per-survey CSVs
 *   zipping    → fflate is compressing the in-memory file map
 *   downloading→ the Blob has been handed to the browser to save
 */
export type ZipBundleProgress = {
  phase: "preparing" | "zipping" | "downloading";
  /** Populated once the server returns; null while still preparing. */
  surveyCount: number | null;
  /** Total rows the bundle will contain, post-filter. */
  totalRows: number | null;
  /** Final filename, available from the `zipping` phase onwards. */
  filename: string | null;
};

const PHASES: Array<{
  key: ZipBundleProgress["phase"];
  label: string;
}> = [
  { key: "preparing", label: "Preparing CSVs…" },
  { key: "zipping", label: "Zipping bundle…" },
  { key: "downloading", label: "Triggering download…" },
];

/**
 * Pure presentational progress card for the ZIP bundle export. Mirrors
 * the look and accessibility contract of `AllValidProgressCard` so the
 * two cards feel like the same family in the admin UI: same
 * `role="status"` + `aria-live="polite"` envelope, same progressbar
 * semantics, same muted-card chrome.
 */
export function ZipBundleProgressCard({ progress }: { progress: ZipBundleProgress }) {
  const phaseIndex = PHASES.findIndex((p) => p.key === progress.phase);
  const safeIndex = phaseIndex < 0 ? 0 : phaseIndex;
  // Bar fills as the operator crosses phase boundaries. Final phase pins
  // at 100% so the user sees a clean completion frame.
  const pct = Math.round(((safeIndex + 1) / PHASES.length) * 100);
  const currentLabel = PHASES[safeIndex].label;

  return (
    <div
      id="zip-bundle-progress"
      className="mb-3 rounded-lg border bg-muted/40 p-3"
      role="status"
      aria-live="polite"
    >
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium">{currentLabel}</span>
        <span className="tabular-nums text-muted-foreground">
          Step {safeIndex + 1} / {PHASES.length} · {pct}%
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="ZIP bundle export progress"
      >
        <div
          className={`h-full rounded-full bg-primary ${
            progress.phase === "downloading"
              ? "transition-[width] duration-700 ease-out"
              : "animate-pulse transition-[width] duration-500 ease-out"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        data-testid="zip-bundle-meta"
        className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 text-[11px] tabular-nums text-muted-foreground"
      >
        <span>
          {progress.surveyCount != null && progress.totalRows != null
            ? `${progress.surveyCount.toLocaleString()} survey${
                progress.surveyCount === 1 ? "" : "s"
              } · ${progress.totalRows.toLocaleString()} row${progress.totalRows === 1 ? "" : "s"}`
            : "Counting…"}
        </span>
        {progress.filename && (
          <span className="truncate" title={progress.filename}>
            {progress.filename}
          </span>
        )}
      </div>
    </div>
  );
}
