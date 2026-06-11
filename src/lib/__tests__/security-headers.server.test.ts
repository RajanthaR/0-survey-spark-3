import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertProductionSecurityConfig,
  buildContentSecurityPolicy,
  readInitialLang,
} from "@/lib/security-headers.server";

describe("security headers and production boot policy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires Turnstile in production", () => {
    expect(() => assertProductionSecurityConfig({ NODE_ENV: "production" })).toThrow(
      /TURNSTILE_SECRET/,
    );
    expect(() =>
      assertProductionSecurityConfig({
        APP_ENV: "production",
        TURNSTILE_SECRET: "secret",
        REDIS_URL: "redis://example",
        ALLOW_TURNSTILE_BYPASS: "true",
      }),
    ).toThrow(/ALLOW_TURNSTILE_BYPASS/);
    expect(() =>
      assertProductionSecurityConfig({
        APP_ENV: "production",
        TURNSTILE_SECRET: "secret",
        REDIS_URL: "redis://example",
        ALLOW_TURNSTILE_BYPASS: "false",
      }),
    ).not.toThrow();
  });

  it("allows production boot when Turnstile is explicitly disabled", () => {
    // The kill-switch lets prod boot without a secret; without the flag the
    // secret is still required (asserted above).
    expect(() =>
      assertProductionSecurityConfig({
        APP_ENV: "production",
        TURNSTILE_DISABLED: "true",
        REDIS_URL: "redis://example",
      }),
    ).not.toThrow();
  });

  it("still rejects ALLOW_TURNSTILE_BYPASS even when Turnstile is disabled", () => {
    // The disable flag must only waive the secret requirement, not act as a
    // blanket skip of the other production invariants.
    expect(() =>
      assertProductionSecurityConfig({
        APP_ENV: "production",
        TURNSTILE_DISABLED: "true",
        REDIS_URL: "redis://example",
        ALLOW_TURNSTILE_BYPASS: "true",
      }),
    ).toThrow(/ALLOW_TURNSTILE_BYPASS/);
  });

  it("requires Redis-backed rate limiting in production", () => {
    expect(() =>
      assertProductionSecurityConfig({
        APP_ENV: "production",
        TURNSTILE_SECRET: "secret",
      }),
    ).toThrow(/REDIS_URL/);
  });

  it("allows in-memory rate limiting in production only with an explicit warning flag", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      assertProductionSecurityConfig({
        APP_ENV: "production",
        TURNSTILE_SECRET: "secret",
        ALLOW_IN_MEMORY_RATE_LIMIT: "true",
      }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ALLOW_IN_MEMORY_RATE_LIMIT=true"));
  });

  it("keeps development and preview fail-open", () => {
    expect(() => assertProductionSecurityConfig({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertProductionSecurityConfig({ ENVIRONMENT: "preview" })).not.toThrow();
  });

  it("builds a nonce-based CSP without script unsafe-inline", () => {
    const csp = buildContentSecurityPolicy("abc123");
    expect(csp).toContain("script-src 'self' 'nonce-abc123'");
    expect(csp).toContain("script-src-elem 'self' 'nonce-abc123'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
  });

  it("reads the SSR language cookie", () => {
    expect(readInitialLang("theme=dark; eip.lang=si")).toBe("si");
    expect(readInitialLang("eip.lang=ta")).toBe("ta");
    expect(readInitialLang("eip.lang=fr")).toBe("en");
    expect(readInitialLang(null)).toBe("en");
  });
});
