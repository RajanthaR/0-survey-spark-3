/**
 * Verifies the Redis-backed rate limiter wiring:
 *   - REDIS_URL set + Redis returns allowed → resolves
 *   - REDIS_URL set + Redis returns blocked → throws Response(429) with Retry-After
 *   - REDIS_URL set + peek returns the parsed snapshot
 *   - REDIS_URL set + Redis call throws → falls back to per-replica in-memory
 *
 * The Redis client is mocked at module level so no real Redis is needed.
 * The Lua script itself is exercised in production; this test pins the
 * argument shape (numberOfKeys=1, [op, capacity, windowMs, now]) and the
 * return-tuple parsing ([tokens, retrySec, allowed]).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ScriptResult = [string, string, string];

const fixtures = vi.hoisted(() => {
  const calls: Array<{
    key: string;
    op: string;
    capacity: number;
    windowMs: number;
    now: number;
  }> = [];
  const state = {
    nextResults: [] as Array<[string, string, string] | Error>,
    definedScript: undefined as { numberOfKeys: number; lua: string } | undefined,
    constructed: 0,
  };

  class FakeRedis {
    constructor(
      public url: string,
      public opts: Record<string, unknown>,
    ) {
      state.constructed += 1;
    }
    defineCommand(_name: string, opts: { numberOfKeys: number; lua: string }) {
      state.definedScript = opts;
    }
    on(_event: string, _handler: (err: Error) => void) {}
    quit() {
      return Promise.resolve("OK");
    }
    async rateLimitTokenBucket(
      key: string,
      op: string,
      capacity: number,
      windowMs: number,
      now: number,
    ) {
      calls.push({ key, op, capacity, windowMs, now });
      const next = state.nextResults.shift();
      if (!next) throw new Error("rate-limit.redis.test: no queued result");
      if (next instanceof Error) throw next;
      return next;
    }
  }

  return { calls, state, FakeRedis };
});

vi.mock("ioredis", () => ({ default: fixtures.FakeRedis }));

const { calls, state } = fixtures;

import { __resetRateLimitForTests, peekRateLimit, rateLimit } from "@/lib/rate-limit.server";

const cfg = { name: "redis-test", capacity: 5, windowMs: 60_000 };
const ORIGINAL_REDIS_URL = process.env.REDIS_URL;

beforeEach(() => {
  calls.length = 0;
  state.nextResults = [];
  state.definedScript = undefined;
  state.constructed = 0;
  process.env.REDIS_URL = "redis://localhost:6379";
  __resetRateLimitForTests();
});

afterEach(() => {
  if (ORIGINAL_REDIS_URL === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = ORIGINAL_REDIS_URL;
  __resetRateLimitForTests();
});

describe("rateLimit — Redis backend", () => {
  it("constructs the Redis client lazily on first call and registers the Lua script", async () => {
    state.nextResults = [["4", "0", "1"] as ScriptResult];
    expect(state.constructed).toBe(0);

    await rateLimit("203.0.113.7", cfg);

    expect(state.constructed).toBe(1);
    expect(state.definedScript?.numberOfKeys).toBe(1);
    expect(state.definedScript?.lua).toMatch(/HMGET/);
    expect(state.definedScript?.lua).toMatch(/PEXPIRE/);
  });

  it("passes the bucket key, op, capacity, windowMs, and now to the script", async () => {
    state.nextResults = [["4", "0", "1"] as ScriptResult];
    await rateLimit("203.0.113.7", cfg);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      key: "rate-limit:redis-test:203.0.113.7",
      op: "consume",
      capacity: 5,
      windowMs: 60_000,
    });
    expect(typeof calls[0]?.now).toBe("number");
  });

  it("throws Response(429) with Retry-After when Redis reports the bucket exhausted", async () => {
    state.nextResults = [["0", "12", "0"] as ScriptResult];

    let captured: unknown;
    try {
      await rateLimit("203.0.113.7", cfg);
    } catch (e) {
      captured = e;
    }

    expect(captured).toBeInstanceOf(Response);
    const res = captured as Response;
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
  });

  it("uses Retry-After=1 as a floor when Redis returns retrySec=0 with allowed=0", async () => {
    state.nextResults = [["0", "0", "0"] as ScriptResult];

    let captured: unknown;
    try {
      await rateLimit("203.0.113.7", cfg);
    } catch (e) {
      captured = e;
    }

    expect((captured as Response).headers.get("Retry-After")).toBe("1");
  });

  it("returns the parsed snapshot for peek without consuming a token", async () => {
    state.nextResults = [["3.5", "0", "peek"] as ScriptResult];

    const snap = await peekRateLimit("203.0.113.7", cfg);

    expect(snap).toEqual({ tokens: 3.5, retrySec: 0 });
    expect(calls[0]?.op).toBe("peek");
  });

  it("falls back to in-memory bucket when the Redis call throws", async () => {
    state.nextResults = [new Error("ECONNREFUSED"), new Error("ECONNREFUSED")];

    // First call: Redis throws → in-memory consumes 1 token → resolves.
    await expect(
      rateLimit("203.0.113.7", { name: "fb", capacity: 1, windowMs: 60_000 }),
    ).resolves.toBeUndefined();
    // Second call with same key: Redis throws again → in-memory has 0 tokens → 429.
    await expect(
      rateLimit("203.0.113.7", { name: "fb", capacity: 1, windowMs: 60_000 }),
    ).rejects.toMatchObject({ status: 429 });
  });
});
