import type { Question } from "@/surveys/types";
import { pickText, UI, type Lang } from "@/lib/i18n";
import { pairwiseAllPairsComplete } from "@/lib/pairwise";

export { pairwiseAllPairsComplete } from "@/lib/pairwise";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const TEL_RE = /^[+()\-\s\d]{6,}$/;

type Answers = Record<string, unknown>;

export type ValidationError =
  | { code: "selectAtLeast"; min: number }
  | { code: "invalidEmail" }
  | { code: "invalidTel" }
  | { code: "invalidNumber" }
  | { code: "ratePairs" };

export function formatValidationError(err: ValidationError, lang: Lang): string {
  switch (err.code) {
    case "selectAtLeast":
      return pickText(UI.selectAtLeast, lang).replace("{n}", String(err.min));
    case "invalidEmail":
      return pickText(UI.invalidEmail, lang);
    case "invalidTel":
      return pickText(UI.invalidTel, lang);
    case "invalidNumber":
      return pickText(UI.invalidNumber, lang);
    case "ratePairs":
      return pickText(UI.ratePairs, lang);
  }
}

export function isAnswered(q: Question, answers: Answers): boolean {
  const v = answers[q.id];
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return String(v).trim().length > 0;
}

/**
 * Returns a language-agnostic error code so callers can store the failure and
 * re-render the message in the user's currently-selected language without
 * stale localized strings sticking to the screen after a language toggle.
 */
export function validateAnswerCode(q: Question, value: unknown): ValidationError | null {
  // Multi-choice min-select: enforce a minimum selection count when set,
  // and (for required) at least one selection. Reported separately from the
  // generic "Required" message so the user understands they must add more.
  if (q.type === "multi_choice") {
    const arr = Array.isArray(value) ? (value as unknown[]) : [];
    const min = Math.max(q.minSelect ?? 0, q.required ? 1 : 0);
    if (min > 1 && arr.length < min) {
      return { code: "selectAtLeast", min };
    }
  }
  // Empty + required is handled separately (different message).
  if (!isAnswered(q, { [q.id]: value })) return null;
  // Pairwise: once the respondent has engaged with the comparison flow at all,
  // every pair must be both decided AND rated from 1..9.
  if (q.type === "pairwise_saaty" && !pairwiseAllPairsComplete(q, value)) {
    return { code: "ratePairs" };
  }
  const s = typeof value === "string" ? value.trim() : value;
  if (q.type === "email" && typeof s === "string" && !EMAIL_RE.test(s)) {
    return { code: "invalidEmail" };
  }
  if (q.type === "tel" && typeof s === "string" && !TEL_RE.test(s)) {
    return { code: "invalidTel" };
  }
  if (q.type === "number_range" && typeof s === "string" && !/^-?\d+(\.\d+)?$/.test(s)) {
    return { code: "invalidNumber" };
  }
  return null;
}

/**
 * Back-compat wrapper that resolves the code into a localized message at call
 * time. Prefer `validateAnswerCode` + `formatValidationError` in new code so
 * the language toggle always re-renders fresh copy.
 */
export function validateAnswer(q: Question, value: unknown, lang: Lang): string | null {
  const err = validateAnswerCode(q, value);
  return err ? formatValidationError(err, lang) : null;
}
