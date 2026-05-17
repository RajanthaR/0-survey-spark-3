/**
 * Bypass requests are NOT exempt from rate limiting.
 *
 * The preview/dev "Continue anyway" escape hatch skips Cloudflare
 * Turnstile, but `startResponse` still runs `rateLimit(...)` first.
 * These tests pin that contract by:
 *   - simulating an exhausted bucket on the first call → assert the
 *     server fn rejects, no insert is attempted, and siteverify is
 *     never reached;
 *   - allowing one call then exhausting the bucket → assert exactly
 *     one row is written (the allowed call) and the over-limit call
 *     never touches the database.
 *
 * Regressions here would let a tester (or anyone who flipped the
 * client flag) flood the responses table from preview.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const insertCalls: Array<Record<string, unknown>> = [];

vi.mock("@/integrations/supabase/client.server", () => {
  const buildFrom = () => ({
    insert: (payload: Record<string, unknown>) => {
      insertCalls.push(payload);
      return {
        select: () => ({
          single: async () => ({
            data: { id: "row-id", resume_token: "tok-from-insert" },
            error: null,
          }),
        }),
      };
    },
  });
  return { createAdminClient: vi.fn(() => ({ from: () => buildFrom() })) };
});

// Programmable rate-limit mock — `setRateLimitBehaviour` decides whether
// the next call passes or throws the standard 429 Response.
let nextCall = 0;
let allowedCalls = 0;
vi.mock("@/lib/rate-limit.server", () => ({
  getClientIp: vi.fn(() => "203.0.113.99"),
  rateLimit: vi.fn(() => {
    nextCall += 1;
    if (nextCall > allowedCalls) {
      throw new Response("Too many requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }
  }),
  __resetRateLimitForTests: vi.fn(),
}));

import { startResponseImpl } from "@/lib/responses.impl.server";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ALLOW_BYPASS = process.env.ALLOW_TURNSTILE_BYPASS;
const ORIGINAL_SECRET = process.env.TURNSTILE_SECRET;

beforeEach(() => {
  insertCalls.length = 0;
  nextCall = 0;
  allowedCalls = 0;
  // Bypass-honouring deploy. We still expect rate limiting to fire
  // regardless of this flag.
  process.env.ALLOW_TURNSTILE_BYPASS = "true";
  process.env.TURNSTILE_SECRET = "test-secret-do-not-use";
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_ALLOW_BYPASS === undefined) delete process.env.ALLOW_TURNSTILE_BYPASS;
  else process.env.ALLOW_TURNSTILE_BYPASS = ORIGINAL_ALLOW_BYPASS;
  if (ORIGINAL_SECRET === undefined) delete process.env.TURNSTILE_SECRET;
  else process.env.TURNSTILE_SECRET = ORIGINAL_SECRET;
  vi.restoreAllMocks();
});

describe("startResponse — bypass requests stay rate-limited", () => {
  it("rejects with 429 + does NOT insert when the rate limit is already exhausted", async () => {
    allowedCalls = 0; // every call throws
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;

    await expect(
      startResponseImpl({
        surveySlug: "demo",
        language: "en",
        consent: { c14: true },
        bypassTurnstile: true,
      }),
    ).rejects.toMatchObject({ status: 429 });

    expect(insertCalls).toHaveLength(0);
    // Siteverify must not be reached — rate limit runs first.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("writes exactly one row when within the limit, then blocks over-limit bypass calls from reaching the database", async () => {
    allowedCalls = 1; // 1 call passes, 2nd throws 429
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;

    // 1st bypass call — allowed by the limiter, insert succeeds.
    await startResponseImpl({
      surveySlug: "demo",
      language: "en",
      consent: { c14: true },
      bypassTurnstile: true,
    });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({
      survey_slug: "demo",
      preview_bypass: true,
    });

    // 2nd bypass call — rate-limited, must not reach the DB.
    await expect(
      startResponseImpl({
        surveySlug: "demo",
        language: "en",
        consent: { c14: true },
        bypassTurnstile: true,
      }),
    ).rejects.toMatchObject({ status: 429 });

    expect(insertCalls).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the 429 Response with a Retry-After header so clients can back off", async () => {
    allowedCalls = 0;

    let captured: unknown;
    try {
      await startResponseImpl({
        surveySlug: "demo",
        language: "en",
        consent: { c14: true },
        bypassTurnstile: true,
      });
    } catch (e) {
      captured = e;
    }

    expect(captured).toBeInstanceOf(Response);
    const res = captured as Response;
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(insertCalls).toHaveLength(0);
  });
});
