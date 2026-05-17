import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetRateLimitForTests, peekRateLimit, rateLimit } from "@/lib/rate-limit.server";

const cfg = { name: "unit", capacity: 1, windowMs: 60_000 };

beforeEach(() => {
  // Pin the clock so the contract on `tokens` after exhaustion is
  // deterministic — without fake timers, the few microseconds between
  // `rateLimit` and `peekRateLimit` accrue a fractional refill that
  // makes `expect(tokens).toBe(0)` flake.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-17T00:00:00Z"));
  __resetRateLimitForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit fallback", () => {
  it("uses the async in-memory fallback when no Durable Object binding exists", async () => {
    await expect(rateLimit("203.0.113.1", cfg)).resolves.toBeUndefined();
    await expect(rateLimit("203.0.113.1", cfg)).rejects.toMatchObject({ status: 429 });

    const snapshot = await peekRateLimit("203.0.113.1", cfg);
    expect(snapshot.tokens).toBe(0);
    expect(snapshot.retrySec).toBe(60);
  });
});
