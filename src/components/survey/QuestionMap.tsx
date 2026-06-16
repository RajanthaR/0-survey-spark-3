import { useMemo, useState } from "react";
import { Check, ListChecks, Circle, Dot } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { pickText, UI, type Lang } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";
import { visibleQuestions } from "@/lib/survey-logic";
import {
  expandSurveySteps,
  isSurveyStepAnswered,
  type SurveyStep,
} from "@/components/survey/runner-steps";

type Answers = Record<string, unknown>;

export function QuestionMap({
  survey,
  answers,
  visible: providedVisible,
  lang,
  currentId,
  onJump,
}: {
  survey: Survey;
  answers: Answers;
  visible?: SurveyStep[];
  lang: Lang;
  currentId: string | undefined;
  onJump: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const visible = useMemo(
    () => providedVisible ?? expandSurveySteps(visibleQuestions(survey, answers)),
    [answers, providedVisible, survey],
  );

  const answeredCount = useMemo(
    () => visible.filter((q) => isSurveyStepAnswered(q, answers)).length,
    [visible, answers],
  );

  // Group by section preserving order.
  const groups = useMemo(() => {
    const out: { section: string; questions: SurveyStep[] }[] = [];
    const idx = new Map<string, number>();
    for (const q of visible) {
      const s = pickText(q.section, lang);
      if (!idx.has(s)) {
        idx.set(s, out.length);
        out.push({ section: s, questions: [] });
      }
      out[idx.get(s)!].questions.push(q);
    }
    return out;
  }, [visible, lang]);

  const firstUnanswered = visible.find((q) => !isSurveyStepAnswered(q, answers));

  function handleJump(id: string) {
    onJump(id);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-full px-3 text-xs"
          aria-label={pickText(UI.questionMap, lang)}
          data-testid="question-map-trigger"
          data-no-swipe
        >
          <ListChecks className="size-4" aria-hidden="true" />
          <span className="tabular-nums">
            {answeredCount}/{visible.length}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full max-w-sm flex-col gap-0 p-0 sm:max-w-sm"
        data-testid="question-map-drawer"
      >
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle>{pickText(UI.questionMap, lang)}</SheetTitle>
          <SheetDescription>{pickText(UI.questionMapLead, lang)}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <ol className="space-y-5">
            {groups.map((g) => (
              <li key={g.section}>
                <h3 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                  {g.section}
                </h3>
                <ul className="space-y-1">
                  {g.questions.map((q) => {
                    const answered = isSurveyStepAnswered(q, answers);
                    const isCurrent = q.id === currentId;
                    const position = visible.findIndex((v) => v.id === q.id) + 1;
                    return (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() => handleJump(q.id)}
                          aria-current={isCurrent ? "step" : undefined}
                          data-answered={answered ? "true" : "false"}
                          data-current={isCurrent ? "true" : "false"}
                          data-testid={`question-map-item-${q.id}`}
                          className={[
                            "group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                            "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isCurrent
                              ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                              : answered
                                ? "border-primary/20 bg-primary/5"
                                : "border-border bg-card",
                          ].join(" ")}
                        >
                          <span
                            aria-hidden="true"
                            className={[
                              "mt-0.5 grid size-6 flex-none place-items-center rounded-full border text-[10px] font-semibold tabular-nums",
                              isCurrent
                                ? "border-primary bg-primary text-primary-foreground"
                                : answered
                                  ? "border-primary/50 bg-primary/15 text-primary"
                                  : "border-border bg-background text-muted-foreground",
                            ].join(" ")}
                          >
                            {answered && !isCurrent ? (
                              <Check className="size-3.5" />
                            ) : isCurrent ? (
                              <Dot className="size-5" />
                            ) : (
                              position
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="line-clamp-2 font-medium leading-snug">
                                {pickText(q.label, lang)}
                              </span>
                              {q.required && !answered && (
                                <span aria-hidden="true" className="text-destructive">
                                  *
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {isCurrent
                                ? pickText(UI.current, lang)
                                : answered
                                  ? pickText(UI.answered, lang)
                                  : pickText(UI.notAnswered, lang)}
                            </span>
                          </span>
                          {!answered && !isCurrent && (
                            <Circle
                              aria-hidden="true"
                              className="mt-1 size-3 flex-none text-muted-foreground/40"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </div>

        {firstUnanswered && (
          <div className="border-t bg-background/95 px-5 py-3">
            <Button
              type="button"
              size="sm"
              className="h-10 w-full rounded-xl"
              onClick={() => handleJump(firstUnanswered.id)}
              data-testid="question-map-next-unanswered"
            >
              {pickText(UI.jumpToNextUnanswered, lang)}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
