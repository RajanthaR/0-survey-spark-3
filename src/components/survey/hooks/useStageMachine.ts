import { useCallback, useEffect, useMemo, useState } from "react";

import { progressFor, visibleQuestions } from "@/lib/survey-logic";
import type { Survey } from "@/surveys/types";

export type SurveyStage =
  | "intro"
  | "consent"
  | "consent-optional"
  | "questions"
  | "review"
  | "contact"
  | "done";

export function useStageMachine({
  survey,
  answers,
  initialToken,
  initialStatus,
}: {
  survey: Survey;
  answers: Record<string, unknown>;
  initialToken?: string;
  initialStatus?: string;
}) {
  const [stage, setStage] = useState<SurveyStage>(
    initialStatus === "completed" ? "done" : initialToken ? "questions" : "intro",
  );
  const visible = useMemo(() => visibleQuestions(survey, answers), [answers, survey]);
  const pct = useMemo(() => progressFor(survey, answers), [answers, survey]);
  const [currentId, setCurrentId] = useState<string | undefined>(() => visible[0]?.id);

  useEffect(() => {
    if (!visible.length) return;
    if (!currentId || !visible.some((q) => q.id === currentId)) {
      setCurrentId(visible[0].id);
    }
  }, [currentId, visible]);

  const idx = currentId ? visible.findIndex((q) => q.id === currentId) : 0;
  const current = idx >= 0 ? visible[idx] : visible[0];

  const jumpToEdit = useCallback((id: string) => {
    setCurrentId(id);
    setStage("questions");
  }, []);

  return { stage, setStage, visible, pct, currentId, setCurrentId, idx, current, jumpToEdit };
}
