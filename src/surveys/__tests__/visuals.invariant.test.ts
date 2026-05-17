import { afterEach, describe, expect, it, vi } from "vitest";

import { SURVEY_LIST } from "@/surveys";
import {
  assertSurveyVisualInvariants,
  findVisualInvariantViolations,
  questionHasVisuals,
} from "@/surveys/validate";
import { DOC_OPTIONS, DOC_SHARING_OPTIONS, LIKERT_5, YES_NO_OPTIONS } from "@/surveys/types";

describe("survey option visuals", () => {
  it("every shared dictionary opts in fully", () => {
    for (const dict of [YES_NO_OPTIONS, LIKERT_5, DOC_OPTIONS, DOC_SHARING_OPTIONS]) {
      expect(questionHasVisuals(dict)).toBe(true);
    }
  });

  it("no survey question mixes options with and without visuals", () => {
    const violations = SURVEY_LIST.flatMap(findVisualInvariantViolations);
    expect(violations).toEqual([]);
  });

  it("detects mixed-state questions", () => {
    const fake = {
      slug: "fake",
      title: { en: "" },
      subtitle: { en: "" },
      estimatedMinutes: 0,
      consent: [],
      questions: [
        {
          id: "mixed",
          type: "single_choice" as const,
          section: { en: "" },
          label: { en: "" },
          options: [
            {
              value: "a",
              label: { en: "a" },
              visual: { kind: "icon" as const, name: "check" as const },
            },
            { value: "b", label: { en: "b" } },
          ],
        },
      ],
    };
    const errs = findVisualInvariantViolations(fake);
    expect(errs.length).toBe(1);
    expect(errs[0]).toMatch(/mixes options/);
  });

  describe("error message detail", () => {
    const fake = (extras: { id: string; opts: Array<{ value: string; visual?: boolean }> }) => ({
      slug: "demo",
      title: { en: "" },
      subtitle: { en: "" },
      estimatedMinutes: 0,
      consent: [],
      questions: [
        {
          id: extras.id,
          type: "single_choice" as const,
          section: { en: "" },
          label: { en: "" },
          options: extras.opts.map((o) => ({
            value: o.value,
            label: { en: o.value },
            ...(o.visual ? { visual: { kind: "icon" as const, name: "check" as const } } : {}),
          })),
        },
      ],
    });

    it("lists the offending option indices and values that need a visual added", () => {
      const errs = findVisualInvariantViolations(
        fake({
          id: "q-add",
          opts: [{ value: "alpha", visual: true }, { value: "beta" }, { value: "gamma" }],
        }),
      );
      expect(errs).toHaveLength(1);
      const msg = errs[0];
      // Per-option indices + values are surfaced verbatim in the error.
      expect(msg).toContain('Question "q-add"');
      expect(msg).toContain("1/3 have a visual");
      expect(msg).toContain('Add a `visual` to: #1 "beta", #2 "gamma"');
      expect(msg).toContain('remove it from: #0 "alpha"');
    });

    it("lists the offending option indices when most options have a visual", () => {
      const errs = findVisualInvariantViolations(
        fake({
          id: "q-remove",
          opts: [{ value: "x", visual: true }, { value: "y", visual: true }, { value: "z" }],
        }),
      );
      expect(errs).toHaveLength(1);
      expect(errs[0]).toContain('Add a `visual` to: #2 "z"');
      expect(errs[0]).toContain('remove it from: #0 "x", #1 "y"');
    });
  });

  describe("assertSurveyVisualInvariants", () => {
    const originalDev = import.meta.env.DEV;
    afterEach(() => {
      (import.meta.env as { DEV: boolean }).DEV = originalDev;
      vi.restoreAllMocks();
    });

    const badSurvey = {
      slug: "bad",
      title: { en: "" },
      subtitle: { en: "" },
      estimatedMinutes: 0,
      consent: [],
      questions: [
        {
          id: "bad-q",
          type: "single_choice" as const,
          section: { en: "" },
          label: { en: "" },
          options: [
            {
              value: "one",
              label: { en: "one" },
              visual: { kind: "icon" as const, name: "check" as const },
            },
            { value: "two", label: { en: "two" } },
          ],
        },
      ],
    };

    it("throws in dev so a bad survey can't ship silently", () => {
      (import.meta.env as { DEV: boolean }).DEV = true;
      expect(() => assertSurveyVisualInvariants([badSurvey])).toThrow(
        /\[bad\] Question "bad-q" mixes options with and without visuals/,
      );
    });

    it("logs (does not throw) in prod and includes the indices+values", () => {
      (import.meta.env as { DEV: boolean }).DEV = false;
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => assertSurveyVisualInvariants([badSurvey])).not.toThrow();
      expect(spy).toHaveBeenCalledTimes(1);
      const logged = String(spy.mock.calls[0][0]);
      expect(logged).toContain('Add a `visual` to: #1 "two"');
      expect(logged).toContain('remove it from: #0 "one"');
    });

    it("is a no-op when every survey is clean", () => {
      (import.meta.env as { DEV: boolean }).DEV = true;
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => assertSurveyVisualInvariants([])).not.toThrow();
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
