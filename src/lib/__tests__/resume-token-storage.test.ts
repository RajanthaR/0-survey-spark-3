import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildResumeUrl,
  getStoredResumeToken,
  persistSearchTokenAndCleanUrl,
  RESUME_TOKEN_TTL_MS,
  resumeStorageKey,
  setStoredResumeToken,
} from "@/lib/resume-token-storage";

const slug = "phase-1";

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("resume token storage", () => {
  it("stores resume tokens under the new key with a 24h sliding TTL", () => {
    setStoredResumeToken(slug, "tok-1", 1_000);
    const first = JSON.parse(window.localStorage.getItem(resumeStorageKey(slug)) ?? "{}") as {
      expiresAt?: number;
    };

    expect(getStoredResumeToken(slug, 2_000)).toBe("tok-1");
    const second = JSON.parse(window.localStorage.getItem(resumeStorageKey(slug)) ?? "{}") as {
      expiresAt?: number;
    };

    expect(first.expiresAt).toBe(1_000 + RESUME_TOKEN_TTL_MS);
    expect(second.expiresAt).toBe(2_000 + RESUME_TOKEN_TTL_MS);
  });

  it("expires stale tokens and migrates legacy keys", () => {
    setStoredResumeToken(slug, "old", 1_000);
    expect(getStoredResumeToken(slug, 1_000 + RESUME_TOKEN_TTL_MS + 1)).toBeUndefined();
    expect(window.localStorage.getItem(resumeStorageKey(slug))).toBeNull();

    window.localStorage.setItem("eip.token.phase-1", "legacy-token");
    expect(getStoredResumeToken(slug, 10_000)).toBe("legacy-token");
    expect(window.localStorage.getItem("eip.token.phase-1")).toBeNull();
    expect(window.localStorage.getItem(resumeStorageKey(slug))).toContain("legacy-token");
  });

  it("cleans legacy ?token URLs while preserving other search params", () => {
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    window.history.replaceState(null, "", "/s/phase-1?token=secret&lang=si#q2");

    expect(persistSearchTokenAndCleanUrl(slug, "secret", 5_000)).toBe("/s/phase-1?lang=si#q2");
    expect(window.location.href).toBe("http://localhost:3000/s/phase-1?lang=si#q2");
    expect(window.localStorage.getItem(resumeStorageKey(slug))).toContain("secret");
    expect(replaceSpy).toHaveBeenCalledWith(null, "", "/s/phase-1?lang=si#q2");
  });

  it("generates explicit /r links", () => {
    expect(buildResumeUrl("tok/with spaces", "https://survey.example")).toBe(
      "https://survey.example/r/tok%2Fwith%20spaces",
    );
  });
});
