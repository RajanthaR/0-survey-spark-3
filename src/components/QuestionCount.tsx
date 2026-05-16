import { useLang, type Lang } from "@/lib/i18n";
import { formatQuestionCount, formatQuestionPosition } from "@/lib/format";

interface CountProps {
  count: number;
  /** Override the language; defaults to the I18n context. */
  lang?: Lang;
  className?: string;
}

/**
 * Renders a localized total question count.
 *   en: "39 questions"
 *   si: "ප්‍රශ්න 39"
 *   ta: "கேள்விகள் 39"
 */
export function QuestionCount({ count, lang, className }: CountProps) {
  const ctx = useLang();
  const effective = lang ?? ctx.lang;
  return (
    <span
      className={className}
      data-testid="question-count"
      data-lang={effective}
    >
      {formatQuestionCount(count, effective)}
    </span>
  );
}

interface PositionProps {
  current: number;
  total: number;
  lang?: Lang;
  className?: string;
  /**
   * When true, the element is announced by screen readers as the value
   * changes (use on the live progress indicator).
   */
  announce?: boolean;
}

/**
 * Renders a localized "Question N of M" / "ප්‍රශ්න N / M" / "கேள்விகள் N / M".
 * Set `announce` to true on the live progress indicator so screen readers
 * speak the localized position whenever the user moves to a new question.
 */
export function QuestionPosition({
  current,
  total,
  lang,
  className,
  announce,
}: PositionProps) {
  const ctx = useLang();
  const effective = lang ?? ctx.lang;
  const text = formatQuestionPosition(current, total, effective);
  return (
    <span
      className={className}
      data-testid="question-position"
      data-lang={effective}
      aria-live={announce ? "polite" : undefined}
      aria-atomic={announce ? true : undefined}
      role={announce ? "status" : undefined}
    >
      {text}
    </span>
  );
}
