// Per-IP token-bucket rate limiter. In-memory Map; lives for the lifetime
// of a single Worker isolate. Acceptable for current traffic; revisit with
// a durable store (KV/DO) when traffic justifies.
import { getRequestHeader } from "@tanstack/react-start/server";

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  /** Bucket name, e.g. "startResponse". */
  name: string;
  /** Max tokens (i.e. allowed requests in the window). */
  capacity: number;
  /** Refill window in milliseconds (full capacity refilled over this period). */
  windowMs: number;
}

export function getClientIp(): string {
  // `getRequestHeader` requires an active H3 request context. In test
  // environments (vitest jsdom) the helpers are invoked directly with no
  // request bound, which throws. We swallow that and fall through to
  // "unknown" so the rate limiter still keys deterministically per test.
  try {
    return (
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      getRequestHeader("x-real-ip") ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

/**
 * Take 1 token from the bucket for `key` under `cfg`. Throws a `Response`
 * with status 429 when exhausted. Server-fn handlers re-raise this directly.
 */
export function rateLimit(key: string, cfg: RateLimitConfig): void {
  const now = Date.now();
  const id = `${cfg.name}:${key}`;
  const refillPerMs = cfg.capacity / cfg.windowMs;
  const cur = buckets.get(id);
  let tokens: number;
  if (!cur) {
    tokens = cfg.capacity - 1;
  } else {
    const elapsed = now - cur.updatedAt;
    tokens = Math.min(cfg.capacity, cur.tokens + elapsed * refillPerMs) - 1;
  }
  if (tokens < 0) {
    // Reset updatedAt so the client must actually wait for refill.
    buckets.set(id, { tokens: 0, updatedAt: now });
    const retrySec = Math.ceil(1 / refillPerMs / 1000);
    throw new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(retrySec) },
    });
  }
  buckets.set(id, { tokens, updatedAt: now });
}

// Test-only reset hook.
export function __resetRateLimitForTests() {
  buckets.clear();
}