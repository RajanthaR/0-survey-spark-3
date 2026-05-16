import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pickText, UI, type Lang } from "@/lib/i18n";
import { type Question, type Survey, YES_NO_OPTIONS } from "@/surveys/types";
import { visibleQuestions } from "@/lib/survey-logic";
import { isAnswered } from "./validation";

type Answers = Record<string, unknown>;

export function formatAnswer(q: Question, value: unknown, lang: Lang): string {
  if (value == null) return "";
  if (q.type === "yes_no") {
    const opt = YES_NO_OPTIONS.find((o) => o.value === String(value));
    return opt ? pickText(opt.label, lang) : String(value);
  }
  if (q.type === "single_choice" || q.type === "multi_choice") {
    const opts = q.options ?? [];
    const arr = Array.isArray(value) ? value : [value];
    return arr
      .map((v) => {
        const o = opts.find((opt) => opt.value === String(v));
        return o ? pickText(o.label, lang) : String(v);
      })
      .join(", ");
  }
  if (q.type === "pairwise_saaty") {
    const obj = value as Record<string, string>;
    return `${Object.keys(obj).length} comparisons`;
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ReviewPanel({
  survey,
  answers,
  lang,
  onEdit,
  onContinue,
}: {
  survey: Survey;
  answers: Answers;
  lang: Lang;
  onEdit: (id: string) => void;
  onContinue: () => void;
}) {
  const visible = visibleQuestions(survey, answers);

  // Group by section
  const groups = new Map<string, Question[]>();
  for (const q of visible) {
    const s = pickText(q.section, lang);
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s)!.push(q);
  }

  const missingRequired = visible.filter((q) => q.required && !isAnswered(q, answers));

  return (
    <motion.section
      key="review"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold">{pickText(UI.reviewTitle, lang)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{pickText(UI.reviewLead, lang)}</p>
      </div>

      {missingRequired.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {missingRequired.length} {pickText(UI.required, lang).toLowerCase()}.
        </div>
      )}

      <div className="space-y-5">
        {Array.from(groups.entries()).map(([section, qs]) => (
          <div key={section} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
              {section}
            </h3>
            <ul className="divide-y rounded-2xl border bg-card">
              {qs.map((q) => {
                const answered = isAnswered(q, answers);
                return (
                  <li key={q.id} className="flex items-start gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">
                        {pickText(q.label, lang)}
                        {q.required && !answered && (
                          <span className="ml-1 text-destructive">*</span>
                        )}
                      </p>
                      <p
                        className={`mt-1 text-xs ${
                          answered ? "text-muted-foreground" : "italic text-destructive/80"
                        }`}
                      >
                        {answered
                          ? formatAnswer(q, answers[q.id], lang)
                          : pickText(UI.notAnswered, lang)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEdit(q.id)}
                      aria-label={pickText(UI.edit, lang)}
                      className="inline-flex items-center gap-1 rounded-lg border bg-background px-2 py-1 text-xs hover:bg-accent/50"
                    >
                      <Pencil className="size-3" /> {pickText(UI.edit, lang)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="safe-bottom sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Button
            variant="outline"
            size="lg"
            className="h-12 rounded-xl"
            onClick={() => onEdit(visible[visible.length - 1]?.id ?? "")}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <Button
            size="lg"
            className="h-12 flex-1 rounded-xl"
            onClick={onContinue}
            disabled={missingRequired.length > 0}
          >
            {pickText(UI.next, lang)}
            <ArrowRight className="ml-1 size-5" />
          </Button>
        </div>
      </div>
    </motion.section>
  );
}