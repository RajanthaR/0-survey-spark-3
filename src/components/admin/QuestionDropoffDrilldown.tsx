import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Drilldown shown when an admin clicks a bar in the drop-off chart.
 *
 * Surfaces the precise response counts behind the percentage shown on
 * the chart, plus the top-N selected answers in the dashboard's
 * currently-selected codebook language (labels are already localized
 * upstream in `localizedQuestionStats`).
 */
export interface QuestionDrilldownData {
  id: string;
  label: string;
  section?: string;
  type?: string;
  answered?: number;
  total?: number;
  answeredPct: number;
  /** Drop-off percentage point vs. the previous question. */
  dropPct: number;
  distribution?: { name: string; value: number }[];
}

export function QuestionDropoffDrilldown({
  open,
  onOpenChange,
  question,
  topN = 5,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: QuestionDrilldownData | null;
  /** How many top-selected answers to render. Default 5. */
  topN?: number;
}) {
  const q = question;
  const total = q?.total ?? 0;
  const answered = q?.answered ?? 0;
  const skipped = Math.max(0, total - answered);
  const top = (q?.distribution ?? []).slice(0, topN);
  const maxValue = top.reduce((m, d) => Math.max(m, d.value), 1);
  const otherCount =
    q?.distribution && q.distribution.length > topN
      ? q.distribution.slice(topN).reduce((s, d) => s + d.value, 0)
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            {q?.label ?? "Question details"}
          </DialogTitle>
          {q && (
            <DialogDescription className="text-xs">
              {q.section ? `${q.section} · ` : ""}
              {q.type ?? "question"}
            </DialogDescription>
          )}
        </DialogHeader>

        {q ? (
          <div className="space-y-4">
            {/* Response counts */}
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-4">
              <Stat label="Answered" value={answered.toLocaleString()} />
              <Stat label="Skipped" value={skipped.toLocaleString()} />
              <Stat label="Reached" value={`${q.answeredPct}%`} />
              <Stat label="Drop-off" value={`${q.dropPct}%`} accent={q.dropPct > 0} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Based on {total.toLocaleString()} {total === 1 ? "respondent" : "respondents"} in
              the current filter. Drop-off is the percentage-point loss vs. the previous
              question.
            </p>

            {/* Top N selected answers */}
            {top.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Top {top.length} selected {top.length === 1 ? "answer" : "answers"}
                </p>
                <ul className="space-y-1.5">
                  {top.map((d) => (
                    <li
                      key={d.name}
                      className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-2 text-xs"
                    >
                      <span className="truncate" title={d.name}>
                        {d.name}
                      </span>
                      <span className="h-2 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${(d.value / maxValue) * 100}%` }}
                        />
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {d.value.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
                {otherCount > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    + {otherCount.toLocaleString()} more in lower-ranked options.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No per-answer distribution for this question type (free text, numeric,
                consent, etc.).
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No question selected.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-base font-semibold tabular-nums ${
          accent ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}