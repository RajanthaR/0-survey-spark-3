import { describe, expect, it } from "vitest";
import { analyticsReportSchema } from "@/lib/admin.stats.functions";

/**
 * Returns the per-field error map produced by the live schema, so each
 * test can assert that the right field carries the right message.
 */
function fieldErrors(input: unknown): Record<string, string> {
  const r = analyticsReportSchema.safeParse(input);
  if (r.success) return {};
  const out: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

describe("getAnalyticsReport date-range validation", () => {
  const schema = analyticsReportSchema;

  it("accepts valid equal dates", () => {
    expect(() =>
      schema.parse({ dateFrom: "2024-06-01", dateTo: "2024-06-01" }),
    ).not.toThrow();
  });

  it("accepts a 366-day span", () => {
    expect(() =>
      schema.parse({ dateFrom: "2024-01-01", dateTo: "2024-12-31" }),
    ).not.toThrow();
  });

  it("rejects an inverted range", () => {
    expect(() =>
      schema.parse({ dateFrom: "2024-12-01", dateTo: "2024-01-01" }),
    ).toThrow(/Start date must be on or before end date/);
  });

  it("rejects a range larger than 366 days", () => {
    expect(() =>
      schema.parse({ dateFrom: "2023-01-01", dateTo: "2024-12-31" }),
    ).toThrow(/Date range cannot exceed 366 days/);
  });

  it("rejects an exactly 367-day span", () => {
    expect(() =>
      schema.parse({ dateFrom: "2024-01-01", dateTo: "2025-01-02" }),
    ).toThrow(/Date range cannot exceed 366 days/);
  });

  // Single-sided ranges are no longer accepted — see the "missing partner"
  // tests below.

  it("accepts no dates at all", () => {
    expect(() => schema.parse({})).not.toThrow();
  });

  it("rejects malformed dateFrom format with a per-field message", () => {
    expect(fieldErrors({ dateFrom: "06/01/2024", dateTo: "2024-06-30" })).toEqual({
      dateFrom: "Start date must be in YYYY-MM-DD format.",
    });
  });

  it("rejects malformed dateTo format with a per-field message", () => {
    expect(fieldErrors({ dateFrom: "2024-06-01", dateTo: "2024/06/30" })).toEqual({
      dateTo: "End date must be in YYYY-MM-DD format.",
    });
  });

  it("rejects an invalid calendar date with a per-field message", () => {
    expect(fieldErrors({ dateFrom: "2024-02-30", dateTo: "2024-03-01" })).toEqual({
      dateFrom: "Start date is not a valid calendar date.",
    });
  });

  it("rejects empty-string date values as malformed", () => {
    expect(fieldErrors({ dateFrom: "", dateTo: "2024-06-30" })).toEqual({
      dateFrom: "Start date is required.",
    });
  });

  it("flags the missing partner when only dateFrom is provided", () => {
    expect(fieldErrors({ dateFrom: "2024-06-01" })).toEqual({
      dateTo: "End date is required when start date is set.",
    });
  });

  it("flags the missing partner when only dateTo is provided", () => {
    expect(fieldErrors({ dateTo: "2024-06-30" })).toEqual({
      dateFrom: "Start date is required when end date is set.",
    });
  });

  it("collects errors on both fields when both are malformed", () => {
    const errs = fieldErrors({ dateFrom: "bad", dateTo: "also-bad" });
    expect(errs.dateFrom).toBe("Start date must be in YYYY-MM-DD format.");
    expect(errs.dateTo).toBe("End date must be in YYYY-MM-DD format.");
  });
});
