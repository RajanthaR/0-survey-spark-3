import { useEffect, useState } from "react";
import { Loader2, Radio, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Compact "Live · Updated Xs ago" pill shown above the analytics cards.
 *
 * Drives nothing on its own — the parent Dashboard owns the polling
 * interval + realtime subscription and just hands us the latest
 * `updatedAt` timestamp + a toggle. We re-render every second so the
 * "Xs ago" label stays fresh without forcing a full dashboard refresh.
 */
export function LiveStatusPill({
  live,
  refreshing,
  updatedAt,
  onToggle,
  onRefreshNow,
}: {
  live: boolean;
  refreshing: boolean;
  updatedAt: number | null;
  onToggle: (next: boolean) => void;
  onRefreshNow: () => void;
}) {
  // Tick once a second so the relative timestamp stays current. The tick
  // only re-renders this pill — the heavy chart cards are unaffected.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const ago = updatedAt ? formatRelative(Date.now() - updatedAt) : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        onClick={() => onToggle(!live)}
        aria-pressed={live}
        aria-label={live ? "Pause live updates" : "Resume live updates"}
        className={[
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
          live
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-muted-foreground/30 bg-muted text-muted-foreground",
        ].join(" ")}
      >
        {live ? (
          <Radio className="size-3 animate-pulse" aria-hidden="true" />
        ) : (
          <Pause className="size-3" aria-hidden="true" />
        )}
        <span className="font-medium">{live ? "Live" : "Paused"}</span>
      </button>

      <span className="text-muted-foreground">
        {refreshing ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            Refreshing…
          </span>
        ) : ago ? (
          <>Updated {ago}</>
        ) : (
          <>Waiting for data…</>
        )}
      </span>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-xs"
        onClick={onRefreshNow}
        disabled={refreshing}
      >
        Refresh
      </Button>
    </div>
  );
}

function formatRelative(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return `${h} h ago`;
}