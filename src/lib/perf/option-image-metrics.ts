/**
 * Lightweight client-side metrics for option image performance.
 *
 * We listen to `PerformanceObserver` resource entries and the service
 * worker's `eip:img-cache-hit` messages, then surface aggregate stats
 * (count, avg/p95 load time, cache-hit rate) to:
 *   - the QA debug overlay (PerfDebugOverlay)
 *   - `console.debug` when ?perf=log is set
 *
 * "Cache hit" here is the OR of three signals:
 *   1. SW cache served the response (postMessage)
 *   2. ResourceTiming `transferSize === 0` with a non-zero
 *      `decodedBodySize` — classic HTTP-cache hit
 *   3. `deliveryType === "cache"` (modern browsers)
 */
const IMAGE_EXT = /\.(?:png|jpe?g|webp|avif|gif|svg)(?:\?.*)?$/i;

export interface ImagePerfSample {
  url: string;
  /** ms — `responseEnd - startTime` from ResourceTiming */
  duration: number;
  hit: boolean;
  source: "sw" | "http" | "network";
  at: number;
}

export interface ImagePerfSnapshot {
  count: number;
  hits: number;
  hitRate: number;
  avgMs: number;
  p95Ms: number;
  recent: ImagePerfSample[];
}

const samples: ImagePerfSample[] = [];
const swHits = new Set<string>();
const listeners = new Set<(s: ImagePerfSnapshot) => void>();
let started = false;

function snapshot(): ImagePerfSnapshot {
  const count = samples.length;
  const hits = samples.reduce((n, s) => n + (s.hit ? 1 : 0), 0);
  const durations = samples.map((s) => s.duration).sort((a, b) => a - b);
  const avgMs = count ? durations.reduce((a, b) => a + b, 0) / count : 0;
  const p95Ms = count ? durations[Math.min(count - 1, Math.floor(count * 0.95))] : 0;
  return {
    count,
    hits,
    hitRate: count ? hits / count : 0,
    avgMs,
    p95Ms,
    recent: samples.slice(-12).reverse(),
  };
}

function emit() {
  const snap = snapshot();
  for (const l of listeners) {
    try {
      l(snap);
    } catch {
      // overlay subscriber crashes shouldn't kill the perf loop
    }
  }
}

function isImageEntry(e: PerformanceResourceTiming): boolean {
  if (e.initiatorType === "img") return true;
  return IMAGE_EXT.test(e.name);
}

function record(entry: PerformanceResourceTiming) {
  if (!isImageEntry(entry)) return;
  const duration = Math.max(0, entry.responseEnd - entry.startTime);
  // deliveryType is in the spec but not yet typed everywhere.
  const deliveryType = (entry as unknown as { deliveryType?: string }).deliveryType;
  const httpHit =
    entry.transferSize === 0 && entry.decodedBodySize > 0;
  const cacheHit = deliveryType === "cache";
  const swHit = swHits.has(entry.name);
  const hit = swHit || httpHit || cacheHit;
  const source: ImagePerfSample["source"] = swHit ? "sw" : hit ? "http" : "network";
  samples.push({ url: entry.name, duration, hit, source, at: Date.now() });
  if (samples.length > 200) samples.splice(0, samples.length - 200);
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("perf") === "log") {
      // eslint-disable-next-line no-console
      console.debug(
        `[eip-perf] img ${source.padEnd(7)} ${duration.toFixed(0).padStart(4)}ms ${entry.name}`,
      );
    }
  }
  emit();
}

export function startImagePerfTracking(): () => void {
  if (typeof window === "undefined") return () => {};
  if (started) return () => {};
  started = true;

  // Backfill anything already in the buffer (registration may happen
  // after some images have already streamed in).
  try {
    for (const e of performance.getEntriesByType("resource")) {
      record(e as PerformanceResourceTiming);
    }
  } catch {
    /* getEntriesByType unsupported — ignore */
  }

  let observer: PerformanceObserver | undefined;
  try {
    observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) record(e as PerformanceResourceTiming);
    });
    observer.observe({ type: "resource", buffered: true });
  } catch {
    /* PerformanceObserver unsupported — ignore */
  }

  const onSwMessage = (ev: MessageEvent) => {
    if (ev.data && ev.data.type === "eip:img-cache-hit" && typeof ev.data.url === "string") {
      swHits.add(ev.data.url);
    }
  };
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", onSwMessage);
  }

  return () => {
    observer?.disconnect();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
    }
    started = false;
  };
}

export function subscribeImagePerf(cb: (s: ImagePerfSnapshot) => void): () => void {
  listeners.add(cb);
  cb(snapshot());
  return () => listeners.delete(cb);
}

export function getImagePerfSnapshot(): ImagePerfSnapshot {
  return snapshot();
}

/** Test/dev helper. */
export function __resetImagePerf(): void {
  samples.length = 0;
  swHits.clear();
  listeners.clear();
  started = false;
}