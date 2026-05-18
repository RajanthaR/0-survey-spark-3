/**
 * Pure drop-off derivation used by the admin dashboard and chart layer.
 */
export type QuestionAnswered = {
  id: string;
  label: string;
  answeredPct: number;
  answered?: number;
  total?: number;
  section?: string;
  type?: string;
  distribution?: { name: string; value: number }[];
};

export function computeDropoff(items: QuestionAnswered[]) {
  const rows = items.map((q, i) => {
    const prevPct = i === 0 ? 100 : items[i - 1].answeredPct;
    const dropPct = Math.max(0, Math.round((prevPct - q.answeredPct) * 10) / 10);
    return {
      id: q.id,
      label: q.label,
      reachedPct: q.answeredPct,
      dropPct,
    };
  });
  const steepestIndex = rows.reduce((best, r, i) => (r.dropPct > rows[best].dropPct ? i : best), 0);
  return { rows, steepestIndex };
}
