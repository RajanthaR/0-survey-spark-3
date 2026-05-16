/**
 * Persistence guarantee — the Turnstile verification gate must run BEFORE
 * any row hits the `responses` table. These tests pin that contract by
 * mocking both `supabaseAdmin` (to capture inserts) and `fetch` (to drive
 * the Cloudflare siteverify response), then asserting:
 *
 *   - missing token         → throws, zero inserts
 *   - siteverify success:false (low score / invalid)  → throws, zero inserts
 *   - siteverify network failure with secret set      → throws, zero inserts
 *   - siteverify success:true                          → inserts exactly one row
 *
 * The guard lives in `verifyTurnstile` (src/lib/turnstile.server.ts) and is
 * called from `startResponse`. Regressions here would let bots write rows.
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
  return { supabaseAdmin: { from: () => buildFrom() } };
});

import { startResponse } from "@/lib/responses.functions";

vi.mock("@/lib/rate-limit.server", () => ({
  getClientIp: vi.fn(() => "203.0.113.42"),
  rateLimit: vi.fn(),
  __resetRateLimitForTests: vi.fn(),
}));

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_SECRET = process.env.TURNSTILE_SECRET;
const ORIGINAL_ALLOW_BYPASS = process.env.ALLOW_TURNSTILE_BYPASS;

function mockSiteverify(response: { ok?: boolean; body?: unknown; reject?: Error }) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (!url.includes("challenges.cloudflare.com/turnstile/v0/siteverify")) {
      throw new Error(`Unexpected fetch in test: ${url}`);
    }
    if (response.reject) throw response.reject;
    return new Response(JSON.stringify(response.body ?? { success: true }), {
      status: response.ok === false ? 500 : 200,
    });
  }) as typeof fetch;
}

beforeEach(() => {
  insertCalls.length = 0;
  // Force the guard into "secret configured" mode so it doesn't fail-open.
  process.env.TURNSTILE_SECRET = "test-secret-do-not-use";
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_SECRET === undefined) delete process.env.TURNSTILE_SECRET;
  else process.env.TURNSTILE_SECRET = ORIGINAL_SECRET;
  if (ORIGINAL_ALLOW_BYPASS === undefined) delete process.env.ALLOW_TURNSTILE_BYPASS;
  else process.env.ALLOW_TURNSTILE_BYPASS = ORIGINAL_ALLOW_BYPASS;
  vi.restoreAllMocks();
});

describe("startResponse — Turnstile guard blocks Supabase writes on verification failure", () => {
  it("rejects + does NOT insert when the token is missing entirely", async () => {
    // Even with the secret set, no fetch should fire — the guard short-circuits
    // on missing input before reaching siteverify.
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;

    await expect(
      startResponse({
        data: { surveySlug: "demo", language: "en", consent: {} },
      }),
    ).rejects.toThrow(/verif|challenge/i);

    expect(insertCalls).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects + does NOT insert when siteverify returns success:false (e.g. low score / invalid token)", async () => {
    mockSiteverify({
      body: { success: false, "error-codes": ["invalid-input-response"] },
    });

    await expect(
      startResponse({
        data: {
          surveySlug: "demo",
          language: "en",
          consent: {},
          turnstileToken: "x".repeat(40),
        },
      }),
    ).rejects.toThrow(/invalid-input-response|Verification failed/i);

    expect(insertCalls).toHaveLength(0);
  });

  it("rejects + does NOT insert when siteverify returns timeout-or-duplicate", async () => {
    mockSiteverify({
      body: { success: false, "error-codes": ["timeout-or-duplicate"] },
    });

    await expect(
      startResponse({
        data: {
          surveySlug: "demo",
          language: "en",
          consent: {},
          turnstileToken: "x".repeat(40),
        },
      }),
    ).rejects.toThrow(/timeout-or-duplicate/i);

    expect(insertCalls).toHaveLength(0);
  });

  it("rejects + does NOT insert when siteverify is unreachable (network error) with secret set", async () => {
    mockSiteverify({ reject: new Error("ECONNRESET") });

    await expect(
      startResponse({
        data: {
          surveySlug: "demo",
          language: "en",
          consent: {},
          turnstileToken: "x".repeat(40),
        },
      }),
    ).rejects.toThrow(/verification service|verif/i);

    expect(insertCalls).toHaveLength(0);
  });

  it("rejects + does NOT insert when siteverify returns a non-2xx HTTP status", async () => {
    mockSiteverify({ ok: false, body: { success: false } });

    await expect(
      startResponse({
        data: {
          surveySlug: "demo",
          language: "en",
          consent: {},
          turnstileToken: "x".repeat(40),
        },
      }),
    ).rejects.toThrow();

    expect(insertCalls).toHaveLength(0);
  });

  it("inserts exactly one row when siteverify returns success:true (positive control)", async () => {
    mockSiteverify({ body: { success: true } });

    await startResponse({
      data: {
        surveySlug: "demo",
        language: "en",
        consent: { c13: true },
        turnstileToken: "x".repeat(40),
      },
    });

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({
      survey_slug: "demo",
      language: "en",
      consent: { c13: true },
    });
  });

  it("rejects + does NOT insert when bypassTurnstile=true but ALLOW_TURNSTILE_BYPASS is not set (bypass not honoured)", async () => {
    // No token, secret is set, bypass flag requested but server not configured
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;

    await expect(
      startResponse({
        data: {
          surveySlug: "demo",
          language: "en",
          consent: {},
          bypassTurnstile: true,
        },
      }),
    ).rejects.toThrow(/verif|challenge/i);

    expect(insertCalls).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("inserts exactly one row when bypassTurnstile=true and ALLOW_TURNSTILE_BYPASS=true", async () => {
    process.env.ALLOW_TURNSTILE_BYPASS = "true";
    // No token, no siteverify call needed — bypass is honoured.
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;

    await startResponse({
      data: {
        surveySlug: "demo",
        language: "en",
        consent: { c14: true },
        bypassTurnstile: true,
      },
    });

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({
      survey_slug: "demo",
      language: "en",
      consent: { c14: true },
      preview_bypass: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("includes remoteip in the siteverify request body when getClientIp returns a real IP", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy as typeof fetch;

    await startResponse({
      data: {
        surveySlug: "demo",
        language: "en",
        consent: { c13: true },
        turnstileToken: "x".repeat(40),
      },
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, reqInit] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { body: URLSearchParams },
    ];
    expect(reqInit.body.get("secret")).toBe("test-secret-do-not-use");
    expect(reqInit.body.get("response")).toBe("x".repeat(40));
    expect(reqInit.body.get("remoteip")).toBe("203.0.113.42");
    expect(insertCalls).toHaveLength(1);
  });
});