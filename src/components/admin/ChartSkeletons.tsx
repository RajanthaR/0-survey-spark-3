import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lightweight chart-shaped skeletons used as Suspense fallbacks and as
 * initial-load placeholders for the admin dashboard. Each skeleton
 * matches the rendered chart's height so swapping in the real chart
 * doesn't trigger a layout shift — live refreshes therefore feel
 * smooth rather than jarring.
 */

export function LineChartSkeleton({ height = 240 }: { height?: number }) {
  // Five vertical bars of varying height suggest a sparkline silhouette.
  const bars = [60, 35, 80, 50, 70, 45, 90];
  return (
    <div
      className="flex w-full items-end gap-2 px-2 pb-6 pt-4 animate-fade-in"
      style={{ height }}
      aria-hidden="true"
    >
      {bars.map((h, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-md"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

export function BarChartSkeleton({ height = 240 }: { height?: number }) {
  const bars = [55, 80, 40, 70, 50];
  return (
    <div
      className="flex w-full items-end justify-around gap-3 px-3 pb-8 pt-4 animate-fade-in"
      style={{ height }}
      aria-hidden="true"
    >
      {bars.map((h, i) => (
        <Skeleton
          key={i}
          className="w-10 rounded-t-md"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

export function PieChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div
      className="grid w-full place-items-center animate-fade-in"
      style={{ height }}
      aria-hidden="true"
    >
      <div className="relative size-[160px]">
        <Skeleton className="absolute inset-0 rounded-full" />
        <div className="absolute inset-[18%] rounded-full bg-card" />
      </div>
    </div>
  );
}

export function HBarListSkeleton({
  rows = 6,
  rowPx = 26,
}: {
  rows?: number;
  rowPx?: number;
}) {
  const height = Math.max(160, rows * rowPx + 40);
  return (
    <div
      className="space-y-2 px-2 py-3 animate-fade-in"
      style={{ height }}
      aria-hidden="true"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton
            className="h-3 flex-1 rounded-full"
            style={{ maxWidth: `${30 + ((i * 17) % 60)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export function StackedBarSkeleton() {
  return (
    <div className="px-2 py-4 animate-fade-in" aria-hidden="true">
      <Skeleton className="h-6 w-full rounded-md" />
    </div>
  );
}
