import { AlertTriangle, BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminAlert } from "./alerts/detect";

interface AlertsPanelProps {
  alerts: AdminAlert[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

function fmtAgo(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export function AlertsPanel({ alerts, onDismiss, onClearAll }: AlertsPanelProps) {
  if (alerts.length === 0) return null;
  const now = Date.now();

  return (
    <section
      aria-live="polite"
      aria-label="Live admin alerts"
      className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 shadow-sm"
      data-testid="admin-alerts-panel"
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <BellRing className="size-4" aria-hidden />
          {alerts.length} live alert{alerts.length === 1 ? "" : "s"}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={onClearAll}
        >
          Dismiss all
        </Button>
      </header>
      <ul className="space-y-2">
        {alerts.map((a) => {
          const critical = a.severity === "critical";
          return (
            <li
              key={a.id}
              className={
                "flex items-start gap-3 rounded-md border p-3 text-sm " +
                (critical
                  ? "border-destructive/60 bg-destructive/10"
                  : "border-amber-500/40 bg-amber-500/10")
              }
              data-severity={a.severity}
              data-kind={a.kind}
            >
              <AlertTriangle
                className={
                  "mt-0.5 size-4 shrink-0 " +
                  (critical ? "text-destructive" : "text-amber-600")
                }
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                {a.kind === "completion_drop" ? (
                  <>
                    <p className="font-medium">
                      Completion rate dropped {a.deltaPp}pp
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.prevPct}% → {a.curPct}% · {fmtAgo(a.at, now)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium truncate" title={a.questionLabel}>
                      Skip spike on “{a.questionLabel}”
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.deltaPp > 0
                        ? `Answered ${a.prevAnsweredPct}% → ${a.curAnsweredPct}% (−${a.deltaPp}pp)`
                        : `Skipped ${a.curSkippedPct}% of responses`}
                      {" · "}
                      {fmtAgo(a.at, now)}
                    </p>
                  </>
                )}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label="Dismiss alert"
                onClick={() => onDismiss(a.id)}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
