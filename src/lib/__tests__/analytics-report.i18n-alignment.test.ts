import { describe, expect, it } from "vitest";
import { analyticsReportSchema } from "@/lib/admin.stats.functions";
import {
  DATE_I18N,
  SERVER_MSG_TO_KEY,
  FIELD_KEYS,
  localizeServerMessage,
} from "@/lib/analytics-report-i18n";
import type { Lang } from "@/lib/i18n";

/**
 * Drives the schema through every failure mode and asserts that:
 *   1. Every English message the server emits has an entry in
 *      SERVER_MSG_TO_KEY (and therefore a translation).
 *   2. The schema only ever attaches issues to the documented field
 *      keys (dateFrom / dateTo / nothing).
 *   3. localizeServerMessage round-trips each message into all three
 *      languages without falling back to English.
 */
const FAILURE_INPUTS: unknown[] = [
  { dateFrom: "" }, // fromRequired
  { dateFrom: "2024-06-01", dateTo: "" }, // toRequired
  { dateFrom: "06/01/2024", dateTo: "2024-06-30" }, // fromFormat
  { dateFrom: "2024-06-01", dateTo: "2024/06/30" }, // toFormat
  { dateFrom: "2024-02-30", dateTo: "2024-03-01" }, // fromCalendar
  { dateFrom: "2024-03-01", dateTo: "2024-02-30" }, // toCalendar
  { dateFrom: "2024-06-01" }, // missingTo
  { dateTo: "2024-06-01" }, // missingFrom
  { dateFrom: "2024-12-01", dateTo: "2024-01-01" }, // inverted
  { dateFrom: "2024-01-01", dateTo: "2025-01-02" }, // tooLong
];

describe("analytics-report i18n alignment", () => {
  it("server schema only attaches issues to documented field keys", () => {
    for (const input of FAILURE_INPUTS) {
      const r = analyticsReportSchema.safeParse(input);
      if (r.success) continue;
      for (const issue of r.error.issues) {
        const key = String(issue.path[0] ?? "");
        expect(FIELD_KEYS as readonly string[]).toContain(key);
      }
    }
  });

  it("every server message has a translation key", () => {
    const seen = new Set<string>();
    for (const input of FAILURE_INPUTS) {
      const r = analyticsReportSchema.safeParse(input);
      if (r.success) continue;
      for (const issue of r.error.issues) seen.add(issue.message);
    }
    for (const msg of seen) {
      expect(SERVER_MSG_TO_KEY[msg], `missing SERVER_MSG_TO_KEY entry for "${msg}"`).toBeDefined();
    }
  });

  it("localizes every server message in every supported language", () => {
    const langs: Lang[] = ["en", "si", "ta"];
    for (const msg of Object.keys(SERVER_MSG_TO_KEY)) {
      for (const lang of langs) {
        const localized = localizeServerMessage(msg, lang);
        expect(localized.length).toBeGreaterThan(0);
        if (lang !== "en") {
          // Non-English locale must not silently fall back to the
          // English string — that means the translation is missing.
          expect(localized).not.toBe(msg);
        }
      }
    }
  });

  it("DATE_I18N has non-empty entries for every key in every language", () => {
    for (const key of Object.keys(DATE_I18N) as Array<keyof typeof DATE_I18N>) {
      for (const lang of ["en", "si", "ta"] as Lang[]) {
        expect(DATE_I18N[key][lang], `DATE_I18N.${String(key)}.${lang} is empty`).toBeTruthy();
      }
    }
  });
});
