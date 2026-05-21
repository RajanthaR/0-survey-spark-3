// Per-IP token-bucket rate limiter. Production uses Redis (Railway add-on)
// when REDIS_URL is set; local/test environments fall back to an in-memory Map.
import Redis from "ioredis";
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

export interface RateLimitSnapshot {
  tokens: number;
  retrySec: number;
}

function bucketId(key: string, cfg: RateLimitConfig): string {
  return `rate-limit:${cfg.name}:${key}`;
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

// Atomic token-bucket consume/peek. Returns [tokens, retrySec, allowed]
// where allowed is "1" / "0" for consume and "peek" for peek.
const RATE_LIMIT_LUA = `
local key = KEYS[1]
local op = ARGV[1]
local cap = tonumber(ARGV[2])
local windowMs = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local refillPerMs = cap / windowMs
local raw = redis.call('HMGET', key, 'tokens', 'updatedAt')
local curTokens = tonumber(raw[1])
local curUpdated = tonumber(raw[2])
local tokens
if curTokens == nil then
  tokens = cap
else
  local elapsed = now - curUpdated
  if elapsed < 0 then elapsed = 0 end
  tokens = math.min(cap, curTokens + elapsed * refillPerMs)
end
local retrySec = 0
if op == 'peek' then
  if tokens <= 0 then retrySec = math.ceil(1 / refillPerMs / 1000) end
  return {tostring(tokens), tostring(retrySec), 'peek'}
end
local allowed
if tokens >= 1 then
  tokens = tokens - 1
  allowed = '1'
else
  tokens = 0
  allowed = '0'
  retrySec = math.ceil(1 / refillPerMs / 1000)
end
redis.call('HMSET', key, 'tokens', tokens, 'updatedAt', now)
redis.call('PEXPIRE', key, math.ceil(windowMs * 2))
return {tostring(tokens), tostring(retrySec), allowed}
`;

type RateLimitedRedis = Redis & {
  rateLimitTokenBucket(
    key: string,
    op: "consume" | "peek",
    capacity: number,
    windowMs: number,
    now: number,
  ): Promise<[string, string, string]>;
};

let redisClient: RateLimitedRedis | undefined;
let redisInitAttempted = false;

function getRedisClient(): RateLimitedRedis | undefined {
  if (redisInitAttempted) return redisClient;
  redisInitAttempted = true;
  const url = process.env.REDIS_URL;
  if (!url) return undefined;
  try {
    const client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    }) as RateLimitedRedis;
    client.defineCommand("rateLimitTokenBucket", {
      numberOfKeys: 1,
      lua: RATE_LIMIT_LUA,
    });
    client.on("error", (err: Error) => {
      console.error("[rate-limit] Redis error:", err?.message ?? err);
    });
    redisClient = client;
  } catch (err) {
    console.error("[rate-limit] failed to construct Redis client:", err);
  }
  return redisClient;
}

async function proxyToRedis(
  op: "consume" | "peek",
  key: string,
  cfg: RateLimitConfig,
): Promise<RateLimitSnapshot | true | undefined> {
  const client = getRedisClient();
  if (!client) return undefined;
  let result: [string, string, string];
  try {
    result = await client.rateLimitTokenBucket(
      bucketId(key, cfg),
      op,
      cfg.capacity,
      cfg.windowMs,
      Date.now(),
    );
  } catch (err) {
    // Redis transiently unavailable. Log and degrade to per-replica
    // in-memory limiter rather than fail-open or fail-closed.
    console.error("[rate-limit] Redis call failed; falling back to in-memory:", err);
    return undefined;
  }
  const tokens = Number(result[0]);
  const retrySec = Number(result[1]);
  if (op === "peek") {
    return { tokens, retrySec };
  }
  if (result[2] === "0") {
    throw new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(retrySec || 1) },
    });
  }
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
  const proxied = await proxyToRedis("consume", key, cfg);
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
  const proxied = await proxyToRedis("peek", key, cfg);
  if (proxied && proxied !== true) return proxied;

  const now = Date.now();
  return snapshotForBucket(buckets.get(bucketId(key, cfg)), cfg, now);
}

// Test-only reset hook. Also disconnects any Redis client so a subsequent
// test that sets REDIS_URL forces a fresh client.
export function __resetRateLimitForTests() {
  buckets.clear();
  if (redisClient) {
    void redisClient.quit().catch(() => {});
  }
  redisClient = undefined;
  redisInitAttempted = false;
}
