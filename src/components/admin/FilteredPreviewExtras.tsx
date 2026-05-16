/**
 * Filtered-export preview surface — per-survey breakdown chips, a
 * sample-rows table, and a daily timeseries mini chart. All three are
 * driven by the `previewFilteredCount` server-fn payload (see
 * `src/lib/admin.functions.ts`), which folds the breakdowns into the
 * same debounced fetch the headline match count already uses, so adding
 * these views costs zero extra round-trips per filter change.
 *
 * Render contract (matches the server-fn return shape):
 *   - `bySurvey`: pre-sorted desc by count; rendered as <Badge> chips
 *     with the localized survey title (falls back to slug for unknown
 *     surveys so analysts can still see what's in the data).
 *   - `sample`: at most 5 rows, the most recent matches by `started_at
 *     desc`; rendered as a compact table with the fields admins use to
 *     eyeball "is this the dataset I expect?" before committing to a
 *     download (response id, survey, language, status, started_at,
 *     contact name).
 *   - `byDay`: only present when both date bounds are set and span ≤
 *     366 days; rendered as a monochrome SVG sparkline (no recharts
 *     dependency — this view re-renders on every keystroke in the
 *     date inputs, so we keep it cheap).
 */
import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SURVEYS } from "@/surveys";
import { pickText, type Lang } from "@/lib/i18n";
import { AdminResponseDetail } from "@/components/admin/AdminResponseDetail";

export type FilteredPreview = {
  matched: number;
  totalFetched: number;
  droppedInvalid: number;
  droppedUnknownSurvey: number;
  bySurvey: Array<{ slug: string; count: number }>;
  /** Exact per-status counts within the current filter window. `other`
   * captures any future / non-canonical status values so the chips still
   * sum to `matched`. */
  byStatus: { completed: number; in_progress: number; other: number };
  byDay: Array<{ date: string; count: number }>;
  sample: Array<{
    id: string;
    survey_slug: string;
    language: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    contact_name: string;
  }>;
  breakdownTruncated: boolean;
  timeseriesAvailable: boolean;
};

function localizedSurveyTitle(slug: string, lang: Lang): string {
  const s = SURVEYS[slug];
  if (!s) return slug;
  return pickText(s.title, lang);
}

function formatStarted(iso: string | null): string {
  if (!iso) return "—";
  // Show "YYYY-MM-DD HH:mm" UTC so it's compact and stable across timezones.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
}

export function FilteredBySurveyChips({
  bySurvey,
  total,
  truncated,
  lang,
}: {
  bySurvey: FilteredPreview["bySurvey"];
  total: number;
  truncated: boolean;
  lang: Lang;
}) {
  if (bySurvey.length === 0) return null;
  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-1.5"
      data-testid="preview-by-survey"
      aria-label="Match count per survey"
    >
      <span className="text-xs text-muted-foreground">By survey:</span>
      {bySurvey.map((b) => {
        const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
        return (
          <Badge
            key={b.slug}
            variant="secondary"
            className="font-normal"
            data-testid={`preview-by-survey-${b.slug}`}
            title={`${b.count.toLocaleString()} of ${total.toLocaleString()} matches (${pct}%)`}
          >
            <span className="font-medium">{localizedSurveyTitle(b.slug, lang)}</span>
            <span className="ml-1 text-muted-foreground">{b.count.toLocaleString()}</span>
          </Badge>
        );
      })}
      {truncated && (
        <span className="text-xs text-muted-foreground" title="Breakdown sampled the first 5,000 matching rows">
          (sampled)
        </span>
      )}
    </div>
  );
}

export function FilteredSampleTable({
  sample,
  lang,
}: {
  sample: FilteredPreview["sample"];
  lang: Lang;
}) {
  if (sample.length === 0) return null;
  // Track which row is expanded to lazy-load the response detail panel.
  // Single-row expansion keeps the preview pane scannable on tablets.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <div
      className="mt-3 overflow-x-auto rounded-md border"
      data-testid="preview-sample-table"
      aria-label="First matching responses"
    >
      <table className="w-full text-xs">
        <caption className="sr-only">
          First {sample.length} matching responses (most recent first)
        </caption>
        <thead className="bg-muted/50 text-left">
          <tr>
            <th scope="col" className="w-6 px-2 py-1.5" aria-label="Expand"></th>
            <th scope="col" className="px-2 py-1.5 font-medium">Response</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Survey</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Lang</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Status</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Started (UTC)</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Contact</th>
          </tr>
        </thead>
        <tbody>
          {sample.map((r) => {
            const isOpen = expandedId === r.id;
            return (
              <Fragment key={r.id}>
                <tr
                  className="cursor-pointer border-t hover:bg-accent/30"
                  data-testid={`preview-sample-row-${r.id}`}
                  onClick={() => setExpandedId(isOpen ? null : r.id)}
                  aria-expanded={isOpen}
                >
                  <td className="px-2 py-1.5 text-muted-foreground">
                    <ChevronRight
                      className={`size-3 transition-transform ${isOpen ? "rotate-90" : ""}`}
                      aria-hidden
                    />
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                    {r.id.slice(0, 8)}
                  </td>
                  <td className="px-2 py-1.5">{localizedSurveyTitle(r.survey_slug, lang)}</td>
                  <td className="px-2 py-1.5 uppercase">{r.language}</td>
                  <td className="px-2 py-1.5">{r.status === "in_progress" ? "in progress" : r.status}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatStarted(r.started_at)}</td>
                  <td className="px-2 py-1.5">{r.contact_name || "—"}</td>
                </tr>
                {isOpen && (
                  <tr
                    className="border-t bg-muted/20"
                    data-testid={`preview-sample-detail-${r.id}`}
                  >
                    <td colSpan={7} className="p-0">
                      <AdminResponseDetail responseId={r.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Lightweight inline-SVG sparkline. We deliberately avoid recharts here
 * because this component re-renders on every keystroke in the date
 * inputs (debounced fetch ⇒ new payload ⇒ new chart) and recharts
 * carries a measurable mount/unmount cost.
 */
export function FilteredDailyChart({
  byDay,
  dateField,
}: {
  byDay: FilteredPreview["byDay"];
  dateField: "started_at" | "completed_at";
}) {
  if (byDay.length === 0) return null;
  const W = 360;
  const H = 56;
  const PAD_X = 4;
  const PAD_Y = 6;
  const max = byDay.reduce((m, d) => Math.max(m, d.count), 0);
  const total = byDay.reduce((sum, d) => sum + d.count, 0);
  const stepX = byDay.length > 1 ? (W - PAD_X * 2) / (byDay.length - 1) : 0;
  const yFor = (n: number) =>
    max === 0 ? H - PAD_Y : H - PAD_Y - ((H - PAD_Y * 2) * n) / max;
  const points = byDay
    .map((d, i) => `${PAD_X + i * stepX},${yFor(d.count)}`)
    .join(" ");
  const peak = byDay.reduce((p, d) => (d.count > p.count ? d : p), byDay[0]);
  const fieldLabel = dateField === "completed_at" ? "completed" : "started";
  return (
    <figure
      className="mt-3 rounded-md border bg-muted/20 p-2"
      data-testid="preview-daily-chart"
      aria-label={`Daily ${fieldLabel} matches across the selected date range`}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
        {byDay.length === 1 && (
          <circle
            cx={PAD_X}
            cy={yFor(byDay[0].count)}
            r={2}
            fill="hsl(var(--primary))"
          />
        )}
      </svg>
      <figcaption className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {byDay[0].date} → {byDay[byDay.length - 1].date} · {byDay.length} day{byDay.length === 1 ? "" : "s"} ({fieldLabel})
        </span>
        <span>
          peak {peak.count.toLocaleString()} on {peak.date} · total {total.toLocaleString()}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Per-status breakdown chips (Completed / In progress) shown next to the
 * filtered-export match count. Renders deterministic chips even when a
 * status is zero so the headline reads consistently across filter
 * changes (e.g. when the user toggles the Status select between
 * "completed", "in_progress", and "all"). The `other` bucket only
 * surfaces when non-zero — it's a forward-compat catch-all for future
 * status values, not something analysts should normally see.
 */
export function FilteredByStatusChips({
  byStatus,
  total,
}: {
  byStatus: FilteredPreview["byStatus"];
  total: number;
}) {
  const items: Array<{ key: "completed" | "in_progress" | "other"; label: string; count: number }> = [
    { key: "completed", label: "Completed", count: byStatus.completed },
    { key: "in_progress", label: "In progress", count: byStatus.in_progress },
  ];
  if (byStatus.other > 0) {
    items.push({ key: "other", label: "Other", count: byStatus.other });
  }
  return (
    <span
      className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle"
      data-testid="preview-by-status"
      aria-label="Match count per submission status"
    >
      {items.map((it) => {
        const pct = total > 0 ? Math.round((it.count / total) * 100) : 0;
        return (
          <Badge
            key={it.key}
            variant="outline"
            className="font-normal"
            data-testid={`preview-by-status-${it.key}`}
            title={`${it.count.toLocaleString()} of ${total.toLocaleString()} matches (${pct}%)`}
          >
            <span className="font-medium">{it.label}</span>
            <span className="ml-1 text-muted-foreground">{it.count.toLocaleString()}</span>
          </Badge>
        );
      })}
    </span>
  );
}
