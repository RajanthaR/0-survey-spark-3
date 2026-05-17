import type { RateLimitConfig, RateLimitSnapshot } from "@/lib/rate-limit.server";

type DurableObjectStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
};

type DurableObjectState = {
  storage: DurableObjectStorage;
};

type Bucket = { tokens: number; updatedAt: number };

type RateLimitRequest = {
  op: "consume" | "peek";
  cfg: RateLimitConfig;
};

function snapshot(
  bucket: Bucket | undefined,
  cfg: RateLimitConfig,
  now: number,
): RateLimitSnapshot {
  const refillPerMs = cfg.capacity / cfg.windowMs;
  const tokens = bucket
    ? Math.min(cfg.capacity, bucket.tokens + (now - bucket.updatedAt) * refillPerMs)
    : cfg.capacity;
  return {
    tokens,
    retrySec: tokens > 0 ? 0 : Math.ceil(1 / refillPerMs / 1000),
  };
}

export class RateLimitDO {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const input = (await req.json()) as RateLimitRequest;
    const now = Date.now();
    const cur = await this.state.storage.get<Bucket>("bucket");

    if (input.op === "peek") {
      return Response.json(snapshot(cur, input.cfg, now));
    }

    const refillPerMs = input.cfg.capacity / input.cfg.windowMs;
    let tokens: number;
    if (!cur) {
      tokens = input.cfg.capacity - 1;
    } else {
      const elapsed = now - cur.updatedAt;
      tokens = Math.min(input.cfg.capacity, cur.tokens + elapsed * refillPerMs) - 1;
    }

    if (tokens < 0) {
      await this.state.storage.put("bucket", { tokens: 0, updatedAt: now });
      const retrySec = Math.ceil(1 / refillPerMs / 1000);
      return new Response("Too many requests", {
        status: 429,
        headers: { "Retry-After": String(retrySec) },
      });
    }

    await this.state.storage.put("bucket", { tokens, updatedAt: now });
    return Response.json({ ok: true });
  }
}
