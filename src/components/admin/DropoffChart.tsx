import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

import { computeDropoff, type QuestionAnswered } from "./dropoff-compute";

export { computeDropoff, type QuestionAnswered } from "./dropoff-compute";

/**
 * Drop-off per question chart.
 *
 * Given each question's `answeredPct` (0–100), we compute the *step
 * drop-off* between question N and question N+1 — i.e. how many
 * percentage points of respondents stopped answering at this question.
 * The first question's drop-off is `100 - answeredPct[0]` (people who
 * landed but didn't engage at all). The steepest drop is highlighted
 * with a reference line so admins can spot the worst offender at a
 * glance.
 *
 * Only meaningful when scoped to a single survey — the parent gates
 * rendering on `slug !== "__all__"`.
 */
export function DropoffChart({
  data,
  onSelect,
  selectedId,
}: {
  data: QuestionAnswered[];
  /**
   * Fired when the admin clicks a bar or presses Enter on a focused row.
   * Receives the question id so the parent can open a drilldown.
   */
  onSelect?: (id: string) => void;
  /** Currently-open question (drilldown). Highlighted with an outline. */
  selectedId?: string | null;
}) {
  const { rows, steepestIndex } = computeDropoff(data);
  const ROW_PX = 26;
  const height = Math.max(180, rows.length * ROW_PX + 40);
  const steepest = rows[steepestIndex];
  const trim = (s: string) => (s.length > 36 ? s.slice(0, 35) + "…" : s);

  const handleBarClick = (payload: { id?: string } | undefined) => {
    if (!onSelect || !payload?.id) return;
    onSelect(payload.id);
  };

  return (
    <div style={{ maxHeight: 420, overflowY: "auto" }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows.map((r) => ({ ...r, label: trim(r.label) }))}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" domain={[0, 100]} fontSize={11} unit="%" />
          <YAxis type="category" dataKey="label" width={180} fontSize={11} interval={0} />
          <Tooltip
            formatter={(v: number, name: string) => [
              `${v}%`,
              name === "dropPct" ? "Drop-off" : "Reached",
            ]}
            labelFormatter={(l: string) => l}
          />
          {steepest && steepest.dropPct > 0 && (
            <ReferenceLine
              x={steepest.dropPct}
              stroke="var(--color-chart-3)"
              strokeDasharray="4 2"
              label={{
                value: `Steepest ${steepest.dropPct}%`,
                position: "right",
                fontSize: 10,
                fill: "var(--color-chart-3)",
              }}
            />
          )}
          <Bar
            dataKey="dropPct"
            radius={[0, 6, 6, 0]}
            cursor={onSelect ? "pointer" : undefined}
            onClick={onSelect ? (p) => handleBarClick(p as { id?: string }) : undefined}
          >
            {rows.map((r, i) => {
              const isSelected = selectedId && r.id === selectedId;
              return (
                <Cell
                  key={r.id}
                  fill={i === steepestIndex ? "var(--color-chart-3)" : "var(--color-chart-2)"}
                  stroke={isSelected ? "var(--color-primary)" : undefined}
                  strokeWidth={isSelected ? 2 : 0}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {onSelect && (
        <ul
          className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2"
          aria-label="Drill into a question's response details"
        >
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-left transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selectedId === r.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <span className="truncate" title={r.label}>
                  {r.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {r.dropPct}% drop
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
