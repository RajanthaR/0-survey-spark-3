/**
 * Formatters for the streaming-export progress UI. Extracted so they can
 * be unit-tested in isolation (see `progress-format.test.ts`).
 */

/** Compact rows-per-second formatter. Returns "0" for non-positive input. */
export function formatRate(rowsPerSecond: number): string {
  if (!Number.isFinite(rowsPerSecond) || rowsPerSecond <= 0) return "0";
  if (rowsPerSecond >= 1000) return `${(rowsPerSecond / 1000).toFixed(1)}k`;
  if (rowsPerSecond >= 100) return `${Math.round(rowsPerSecond)}`;
  return rowsPerSecond.toFixed(1);
}

/**
 * Human ETA with the unit coarsening as the duration grows so the value
 * doesn't visibly jitter every chunk: `<1s` / `12s` / `3m 20s` / `1h 14m`.
 */
export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const totalSec = Math.round(seconds);
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Compact byte-size formatter for "estimated remaining file size" hints.
 * Uses 1024-based units and one decimal beyond KB so the readout doesn't
 * jitter wildly while bytes-per-row is still being learned.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(2) : mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb < 10 ? gb.toFixed(2) : gb.toFixed(1)} GB`;
}
