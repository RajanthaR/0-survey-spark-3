import type { Lang } from "@/lib/i18n";

/**
 * Localized "question(s)" noun.
 * Sinhala uses "ප්‍රශ්න" (plural) regardless of count; Tamil uses "கேள்விகள்".
 * Numbers always come AFTER the noun in si/ta (noun-first), and BEFORE in en.
 */
const QUESTION_NOUN: Record<Lang, string> = {
  en: "questions",
  si: "ප්‍රශ්න",
  ta: "கேள்விகள்",
};

/**
 * Total question count, e.g.
 *   en: "39 questions"
 *   si: "ප්‍රශ්න 39"
 *   ta: "கேள்விகள் 39"
 */
export function formatQuestionCount(n: number, lang: Lang): string {
  if (lang === "en") return `${n} ${QUESTION_NOUN.en}`;
  return `${QUESTION_NOUN[lang]} ${n}`;
}

/**
 * Position within the survey, e.g.
 *   en: "Question 3 of 39"
 *   si: "ප්‍රශ්න 3 / 39"
 *   ta: "கேள்விகள் 3 / 39"
 */
export function formatQuestionPosition(
  current: number,
  total: number,
  lang: Lang,
): string {
  if (lang === "en") return `Question ${current} of ${total}`;
  return `${QUESTION_NOUN[lang]} ${current} / ${total}`;
}
