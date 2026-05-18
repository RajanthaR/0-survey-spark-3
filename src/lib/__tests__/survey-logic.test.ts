import { describe, expect, it } from "vitest";
import { isVisible, progressFor, sectionBreakdown, visibleQuestions } from "@/lib/survey-logic";
import type { Question, Survey } from "@/surveys/types";

const txt = (s: string) => ({ en: s, si: s, ta: s });

const baseSurvey: Survey = {
  slug: "test",
  title: txt("Test"),
  subtitle: txt("Test subtitle"),
  estimatedMinutes: 5,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "single_choice",
      section: txt("Intro"),
      label: txt("Pick one"),
      required: true,
      options: [
        { value: "a", label: txt("A") },
        { value: "b", label: txt("B") },
      ],
    },
    {
      id: "q2",
      type: "text",
      section: txt("Intro"),
      label: txt("Why?"),
      showIf: { questionId: "q1", equals: "a" },
    },
    {
      id: "q3",
      type: "text",
      section: txt("Followup"),
      label: txt("Anything else?"),
      showIf: { questionId: "q1", op: "neq", value: "a" },
    },
    {
      id: "q4",
      type: "text",
      section: txt("Followup"),
      label: txt("Bonus"),
      showIf: { questionId: "q1", op: "answered" },
    },
  ] satisfies Question[],
};

describe("isVisible", () => {
  it("returns true when no showIf", () => {
    expect(isVisible(baseSurvey.questions[0], {})).toBe(true);
  });

  it("legacy equals matches", () => {
    expect(isVisible(baseSurvey.questions[1], { q1: "a" })).toBe(true);
    expect(isVisible(baseSurvey.questions[1], { q1: "b" })).toBe(false);
  });

  it("neq excludes matched value", () => {
    expect(isVisible(baseSurvey.questions[2], { q1: "a" })).toBe(false);
    expect(isVisible(baseSurvey.questions[2], { q1: "b" })).toBe(true);
    expect(isVisible(baseSurvey.questions[2], {})).toBe(false);
  });

  it("answered checks for any value", () => {
    expect(isVisible(baseSurvey.questions[3], {})).toBe(false);
    expect(isVisible(baseSurvey.questions[3], { q1: "" })).toBe(false);
    expect(isVisible(baseSurvey.questions[3], { q1: "b" })).toBe(true);
  });
});

describe("progressFor", () => {
  it("is 0 when nothing answered", () => {
    expect(progressFor(baseSurvey, {})).toBe(0);
  });

  it("counts only visible answered questions", () => {
    // q1=a → visible: q1, q2, q4 (q3 hidden). Only q1 answered → 33%.
    expect(progressFor(baseSurvey, { q1: "a" })).toBe(33);
  });

  it("hits 100 when all visible answered", () => {
    expect(progressFor(baseSurvey, { q1: "a", q2: "yes", q4: "ok" })).toBe(100);
  });
});

describe("visibleQuestions", () => {
  it("filters hidden branches", () => {
    const v = visibleQuestions(baseSurvey, { q1: "a" }).map((q) => q.id);
    expect(v).toEqual(["q1", "q2", "q4"]);
  });
});

describe("sectionBreakdown", () => {
  it("aggregates per section with pct", () => {
    const out = sectionBreakdown(baseSurvey, { q1: "a", q2: "yes" }, "en");
    const intro = out.find((s) => s.name === "Intro")!;
    const followup = out.find((s) => s.name === "Followup")!;
    expect(intro).toEqual({ name: "Intro", total: 2, done: 2, pct: 100 });
    expect(followup.total).toBe(1);
    expect(followup.done).toBe(0);
    expect(followup.pct).toBe(0);
  });
});
