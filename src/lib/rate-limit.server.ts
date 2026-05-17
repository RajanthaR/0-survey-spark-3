// Per-IP token-bucket rate limiter. Production uses the RATE_LIMIT Durable
// Object binding; local/test environments fall back to an in-memory Map.
import { getRequestHeader } from "@tanstack/react-start/server";
import { getGlobalStartContext } from "@tanstack/start-client-core";

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

type DurableObjectId = unknown;
type DurableObjectStub = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};
type DurableObjectNamespace = {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
};
type StartContextWithCloudflare = {
  cloudflareEnv?: {
    RATE_LIMIT?: DurableObjectNamespace;
  };
};

export interface RateLimitConfig {
  /** Bucket name, e.g. "startResponse". */
  name: string;
  /** Max tokens (i.e. allowed requests in the window). */
  capacity: number;
  /** Refill window in milliseconds (full capacity refilled over this period). */
  windowMs: number;
}

export interface RateLimitSnapshot {
  tokens: number;
  retrySec: number;
}

function bucketId(key: string, cfg: RateLimitConfig): string {
  return `${cfg.name}:${key}`;
}

function snapshotForBucket(bucket: Bucket | undefined, cfg: RateLimitConfig, now: number) {
  const refillPerMs = cfg.capacity / cfg.windowMs;
  const tokens = bucket
    ? Math.min(cfg.capacity, bucket.tokens + (now - bucket.updatedAt) * refillPerMs)
    : cfg.capacity;

  return {
    tokens,
    retrySec: tokens > 0 ? 0 : Math.ceil(1 / refillPerMs / 1000),
  };
}

function getRateLimitNamespace(): DurableObjectNamespace | undefined {
  try {
    const context = getGlobalStartContext() as StartContextWithCloudflare | undefined;
    return context?.cloudflareEnv?.RATE_LIMIT;
  } catch {
    return undefined;
  }
}

async function proxyToDurableObject(
  op: "consume" | "peek",
  key: string,
  cfg: RateLimitConfig,
): Promise<RateLimitSnapshot | true | undefined> {
  const namespace = getRateLimitNamespace();
  if (!namespace) return undefined;

  const id = namespace.idFromName(bucketId(key, cfg));
  const stub = namespace.get(id);
  const res = await stub.fetch("https://rate-limit.local/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, cfg }),
  });

  if (res.status === 429) {
    throw new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": res.headers.get("Retry-After") ?? "1" },
    });
  }

  if (!res.ok) {
    throw new Error(`Rate limit Durable Object failed with HTTP ${res.status}`);
  }

  if (op === "peek") return (await res.json()) as RateLimitSnapshot;
  return true;
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
export async function rateLimit(key: string, cfg: RateLimitConfig): Promise<void> {
  const proxied = await proxyToDurableObject("consume", key, cfg);
  if (proxied) return;

  const now = Date.now();
  const id = bucketId(key, cfg);
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

/**
 * Read the current bucket state without consuming a token.
 */
export async function peekRateLimit(key: string, cfg: RateLimitConfig): Promise<RateLimitSnapshot> {
  const proxied = await proxyToDurableObject("peek", key, cfg);
  if (proxied && proxied !== true) return proxied;

  const now = Date.now();
  return snapshotForBucket(buckets.get(bucketId(key, cfg)), cfg, now);
}

// Test-only reset hook.
export function __resetRateLimitForTests() {
  buckets.clear();
}
