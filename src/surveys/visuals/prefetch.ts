/**
 * Image prefetch + cache helpers for option visuals.
 *
 * Why this exists:
 *  - Option illustrations are static, hashed assets — the browser HTTP cache
 *    already handles long-term caching (Vite emits immutable filenames).
 *  - The remaining win is *warming* the cache for upcoming questions while
 *    the user is answering the current one, so the next screen never blocks
 *    on a cold network round-trip. This matters on 3G / low-end mobile.
 *  - We dedupe per-src so we never enqueue the same URL twice in a session
 *    (and never if the asset has already loaded once).
 */
import type { Option } from "@/surveys/types";

const seen = new Set<string>();

/**
 * How many upcoming questions to warm the cache for, beyond the current
 * one. Default 3 — comfortably covers the typical thumb-scroll cadence
 * on mobile without flooding cold connections. Callers (tests, debug
 * tooling) can override via `prefetchUpcomingOptionImages(..., { horizon })`
 * or the module-level setter.
 */
export const DEFAULT_PREFETCH_HORIZON = 3;
let currentHorizon = DEFAULT_PREFETCH_HORIZON;

export function setPrefetchHorizon(n: number): void {
  currentHorizon = Math.max(0, Math.min(10, Math.floor(n)));
}

export function getPrefetchHorizon(): number {
  return currentHorizon;
}

function prefetchOne(src: string): void {
  if (seen.has(src)) return;
  seen.add(src);
  if (typeof window === "undefined") return;
  // <img> with eager load is the most widely-supported, cheapest way to
  // warm the HTTP cache. fetchpriority=low keeps it off the critical path.
  const img = new Image();
  img.decoding = "async";
  // fetchPriority is on HTMLImageElement in modern browsers but not always
  // typed; assign via index access to stay portable across TS lib versions.
  (img as unknown as Record<string, string>).fetchPriority = "low";
  img.src = src;
}

export function prefetchOptionImages(opts: Option[] | undefined): void {
  if (!opts) return;
  for (const o of opts) {
    if (o.visual?.kind === "image") prefetchOne(o.visual.src);
  }
}

/**
 * Warm the cache for the next N questions' option images. Walks
 * `visible.slice(idx + 1, idx + 1 + horizon)` so the caller doesn't need
 * to repeat the slice in every effect. Per-src dedupe is shared with
 * `prefetchOptionImages`, so calling both is safe and cheap.
 */
export function prefetchUpcomingOptionImages(
  visible: ReadonlyArray<{ options?: Option[] }>,
  idx: number,
  opts: { horizon?: number } = {},
): void {
  const horizon = opts.horizon ?? currentHorizon;
  if (horizon <= 0) return;
  const end = Math.min(visible.length, idx + 1 + horizon);
  for (let i = idx + 1; i < end; i++) {
    prefetchOptionImages(visible[i]?.options);
  }
}

/** Test/dev helper — clear the dedupe set. */
export function __resetPrefetchCache(): void {
  seen.clear();
  currentHorizon = DEFAULT_PREFETCH_HORIZON;
}
