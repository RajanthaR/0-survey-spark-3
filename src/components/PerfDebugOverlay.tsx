import { useEffect, useState } from "react";
import {
  startImagePerfTracking,
  subscribeImagePerf,
  type ImagePerfSnapshot,
} from "@/lib/perf/option-image-metrics";

/**
 * Tiny fixed-position QA overlay that surfaces option-image perf stats.
 * Hidden by default; enabled with `?perf=1` or `localStorage.eip.perfDebug = "1"`.
 */
export function PerfDebugOverlay() {
  const [snap, setSnap] = useState<ImagePerfSnapshot | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("perf");
    const ls = window.localStorage.getItem("eip.perfDebug");
    const on = flag === "1" || flag === "log" || ls === "1";
    if (!on) return;
    setEnabled(true);
    const stop = startImagePerfTracking();
    const unsub = subscribeImagePerf(setSnap);
    return () => {
      unsub();
      stop();
    };
  }, []);

  if (!enabled || !snap) return null;

  return (
    <div
      role="status"
      aria-live="off"
      className="fixed bottom-3 right-3 z-[9999] max-w-[min(360px,calc(100vw-1.5rem))] rounded-lg border border-border bg-background/95 p-3 text-[11px] font-mono shadow-lg backdrop-blur"
      style={{ pointerEvents: "auto" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">eip-perf · img</span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted"
        >
          {collapsed ? "▾" : "▴"}
        </button>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span className="text-muted-foreground">count</span>
        <span className="text-right">{snap.count}</span>
        <span className="text-muted-foreground">hit rate</span>
        <span className="text-right">{(snap.hitRate * 100).toFixed(0)}%</span>
        <span className="text-muted-foreground">avg</span>
        <span className="text-right">{snap.avgMs.toFixed(0)}ms</span>
        <span className="text-muted-foreground">p95</span>
        <span className="text-right">{snap.p95Ms.toFixed(0)}ms</span>
      </div>
      {!collapsed && snap.recent.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-0.5 overflow-auto border-t border-border pt-1">
          {snap.recent.map((s, i) => (
            <li key={`${s.at}-${i}`} className="flex items-center justify-between gap-2">
              <span
                className={
                  s.source === "sw"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : s.source === "http"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground"
                }
              >
                {s.source}
              </span>
              <span className="truncate" title={s.url}>
                {s.url.split("/").pop()}
              </span>
              <span className="tabular-nums">{s.duration.toFixed(0)}ms</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
