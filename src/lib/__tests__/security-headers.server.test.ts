import { describe, expect, it } from "vitest";

import {
  assertProductionSecurityConfig,
  buildContentSecurityPolicy,
  readInitialLang,
} from "@/lib/security-headers.server";

describe("security headers and production boot policy", () => {
  it("requires Turnstile in production", () => {
    expect(() => assertProductionSecurityConfig({ NODE_ENV: "production" })).toThrow(
      /TURNSTILE_SECRET/,
    );
    expect(() =>
      assertProductionSecurityConfig({
        APP_ENV: "production",
        TURNSTILE_SECRET: "secret",
        ALLOW_TURNSTILE_BYPASS: "true",
      }),
    ).toThrow(/ALLOW_TURNSTILE_BYPASS/);
    expect(() =>
      assertProductionSecurityConfig({
        APP_ENV: "production",
        TURNSTILE_SECRET: "secret",
        ALLOW_TURNSTILE_BYPASS: "false",
      }),
    ).not.toThrow();
  });

  it("allows production boot when Turnstile is explicitly disabled", () => {
    // The kill-switch lets prod boot without a secret; without the flag the
    // secret is still required (asserted above).
    expect(() =>
      assertProductionSecurityConfig({ APP_ENV: "production", TURNSTILE_DISABLED: "true" }),
    ).not.toThrow();
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
