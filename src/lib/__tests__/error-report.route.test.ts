import { describe, expect, it, vi } from "vitest";

import {
  CLIENT_ERROR_REPORT_LIMIT,
  ErrorReportSchema,
  handleErrorReport,
} from "@/routes/api/error-report";

const VALID_PAYLOAD = {
  message: "Crash in the language toggle",
  stack: "Error: Crash\n    at test",
  url: "https://example.test/s/phase-1?lang=en",
  lang: "en",
} as const;

function jsonRequest(body: unknown): Request {
  return new Request("https://example.test/api/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function textRequest(body: string): Request {
  return new Request("https://example.test/api/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("error-report API route", () => {
  it("validates the strict client error schema", () => {
    expect(ErrorReportSchema.parse(VALID_PAYLOAD)).toEqual(VALID_PAYLOAD);
    expect(ErrorReportSchema.safeParse({ ...VALID_PAYLOAD, extra: "nope" }).success).toBe(false);
    expect(ErrorReportSchema.safeParse({ ...VALID_PAYLOAD, lang: "fr" }).success).toBe(false);
    expect(
      ErrorReportSchema.safeParse({ ...VALID_PAYLOAD, message: "x".repeat(2001) }).success,
    ).toBe(false);
    expect(ErrorReportSchema.safeParse({ ...VALID_PAYLOAD, stack: "x".repeat(8001) }).success).toBe(
      false,
    );
    expect(ErrorReportSchema.safeParse({ ...VALID_PAYLOAD, url: "x".repeat(501) }).success).toBe(
      false,
    );
  });

  it("logs validated input and returns 204 without echoing the payload", async () => {
    const rateLimit = vi.fn(async () => {});
    const getClientIp = vi.fn(() => "203.0.113.10");
    const logger = { error: vi.fn() };

    const response = await handleErrorReport(jsonRequest(VALID_PAYLOAD), {
      getClientIp,
      logger,
      rateLimit,
    });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(rateLimit).toHaveBeenCalledWith("203.0.113.10", CLIENT_ERROR_REPORT_LIMIT);
    expect(logger.error).toHaveBeenCalledWith("[client-error]", VALID_PAYLOAD);
  });

  it("rejects invalid JSON and invalid payloads with 400", async () => {
    const rateLimit = vi.fn(async () => {});
    const logger = { error: vi.fn() };

    const invalidJson = await handleErrorReport(textRequest("{"), { logger, rateLimit });
    expect(invalidJson.status).toBe(400);
    expect(await invalidJson.text()).toBe("Bad request");

    const invalidPayload = await handleErrorReport(
      jsonRequest({ message: "boom", url: "https://example.test", extra: "secret" }),
      { logger, rateLimit },
    );
    expect(invalidPayload.status).toBe(400);
    expect(await invalidPayload.text()).toBe("Bad request");
    expect(rateLimit).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns the rate-limit response before logging", async () => {
    const logger = { error: vi.fn() };
    const rateLimit = vi.fn(async () => {
      throw new Response("Too many requests", {
        status: 429,
        headers: { "Retry-After": "12" },
      });
    });

    const response = await handleErrorReport(jsonRequest(VALID_PAYLOAD), {
      getClientIp: () => "203.0.113.10",
      logger,
      rateLimit,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    expect(logger.error).not.toHaveBeenCalled();
  });
});
