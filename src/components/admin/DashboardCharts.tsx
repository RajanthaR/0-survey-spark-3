import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

// Snappy-but-smooth defaults for live updates. Recharts ships with a
// 1500ms default which feels sluggish when the dashboard polls every
// 15s; ~450ms with an ease-out curve is fast enough to feel responsive
// while still reading as an animated transition rather than a snap.
const ANIM_MS = 450;
const ANIM_EASE = "ease-out" as const;

export function DailyLineChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="date" fontSize={11} />
        <YAxis allowDecimals={false} fontSize={11} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="count"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive
          animationDuration={ANIM_MS}
          animationEasing={ANIM_EASE}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LangPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={3}
          isAnimationActive
          animationDuration={ANIM_MS}
          animationEasing={ANIM_EASE}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SurveyBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="name" fontSize={11} />
        <YAxis allowDecimals={false} fontSize={11} />
        <Tooltip />
        <Bar
          dataKey="value"
          radius={[8, 8, 0, 0]}
          isAnimationActive
          animationDuration={ANIM_MS}
          animationEasing={ANIM_EASE}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Horizontal bar chart of per-question answered % across the response set.
 * Each row is one question; the bar runs 0–100. The bar is clipped to a
 * fixed height per row so a long survey scrolls inside its container rather
 * than growing the page.
 */
export function QuestionCompletionChart({
  data,
}: {
  data: { id: string; label: string; answeredPct: number }[];
}) {
  const ROW_PX = 26;
  const height = Math.max(160, data.length * ROW_PX + 40);
  // Truncate long question labels for the Y axis tick.
  const trim = (s: string) => (s.length > 36 ? s.slice(0, 35) + "…" : s);
  return (
    <div style={{ maxHeight: 420, overflowY: "auto" }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data.map((d) => ({ ...d, label: trim(d.label) }))}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" domain={[0, 100]} fontSize={11} unit="%" />
          <YAxis
            type="category"
            dataKey="label"
            width={180}
            fontSize={11}
            interval={0}
          />
          <Tooltip
            formatter={(v: number) => [`${v}%`, "Answered"]}
            labelFormatter={(l: string) => l}
          />
          <Bar
            dataKey="answeredPct"
            radius={[0, 6, 6, 0]}
            fill="var(--color-chart-1)"
            isAnimationActive
            animationDuration={ANIM_MS}
            animationEasing={ANIM_EASE}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Two-segment "answered vs skipped" stacked bar — gives the at-a-glance
 * proportion across every question × respondent. Renders as a single
 * stacked horizontal bar.
 */
export function AnsweredSkippedBar({
  answered,
  skipped,
}: {
  answered: number;
  skipped: number;
}) {
  const data = [{ name: "All questions", answered, skipped }];
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" hide />
        <Tooltip
          formatter={(v: number, name: string) => [v.toLocaleString(), name === "answered" ? "Selected" : "Skipped"]}
        />
        <Legend formatter={(v) => (v === "answered" ? "Selected" : "Skipped")} />
        <Bar
          dataKey="answered"
          stackId="a"
          fill="var(--color-chart-1)"
          radius={[8, 0, 0, 8]}
          isAnimationActive
          animationDuration={ANIM_MS}
          animationEasing={ANIM_EASE}
        />
        <Bar
          dataKey="skipped"
          stackId="a"
          fill="var(--color-chart-3)"
          radius={[0, 8, 8, 0]}
          isAnimationActive
          animationDuration={ANIM_MS}
          animationEasing={ANIM_EASE}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
