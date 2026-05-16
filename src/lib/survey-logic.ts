import type { Question, Survey } from "@/surveys/types";

type Answers = Record<string, unknown>;

function isAnsweredVal(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return String(v).trim().length > 0;
}

export function isVisible(q: Question, answers: Answers): boolean {
  if (!q.showIf) return true;
  const cond = q.showIf;
  const v = answers[cond.questionId];

  // Legacy `equals` form → treat as `op: "eq"`.
  const op = "op" in cond ? cond.op : "eq";
  const target = "op" in cond ? cond.value : cond.equals;

  if (op === "answered") return isAnsweredVal(v);

  const targets = Array.isArray(target) ? target : target == null ? [] : [target];

  if (op === "neq") {
    if (!isAnsweredVal(v)) return false;
    if (Array.isArray(v)) return !v.some((x) => targets.includes(String(x)));
    return !targets.includes(String(v));
  }

  // eq | in (both behave the same: any match)
  if (Array.isArray(v)) return v.some((x) => targets.includes(String(x)));
  if (v == null) return false;
  return targets.includes(String(v));
}

export function visibleQuestions(survey: Survey, answers: Answers): Question[] {
  return survey.questions.filter((q) => q.type !== "section_header" && isVisible(q, answers));
}

export function isAnswered(q: Question, answers: Answers): boolean {
  const v = answers[q.id];
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return String(v).trim().length > 0;
}

/**
 * A response counts as "valid" when every currently-visible required
 * question on its survey has an answer. Conditional (showIf) branches that
 * resolve to hidden are ignored — those answers were never asked.
 */
export function isValidCompletedResponse(survey: Survey, answers: Answers): boolean {
  const vis = visibleQuestions(survey, answers);
  for (const q of vis) {
    if (!q.required) continue;
    if (!isAnswered(q, answers)) return false;
    // Multi-choice min-select: honor the same gate the runner enforces.
    if (q.type === "multi_choice") {
      const v = answers[q.id];
      const arr = Array.isArray(v) ? v : [];
      const min = Math.max(q.minSelect ?? 0, q.required ? 1 : 0);
      if (arr.length < min) return false;
    }
  }
  return true;
}

export function progressFor(survey: Survey, answers: Answers): number {
  const vis = visibleQuestions(survey, answers);
  if (!vis.length) return 0;
  const done = vis.filter((q) => isAnswered(q, answers)).length;
  return Math.round((done / vis.length) * 100);
}

/** Section completion table for the admin dashboard. */
export function sectionBreakdown(survey: Survey, answers: Answers, lang: "en" | "si" | "ta") {
  const vis = visibleQuestions(survey, answers);
  const map = new Map<string, { name: string; total: number; done: number }>();
  for (const q of vis) {
    const name = q.section[lang] || q.section.en;
    const cur = map.get(name) ?? { name, total: 0, done: 0 };
    cur.total += 1;
    if (isAnswered(q, answers)) cur.done += 1;
    map.set(name, cur);
  }
  return Array.from(map.values()).map((s) => ({
    ...s,
    pct: s.total ? Math.round((s.done / s.total) * 100) : 0,
  }));
}
