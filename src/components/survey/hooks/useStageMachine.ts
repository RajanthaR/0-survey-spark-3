import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  progressForVisible,
  visibilityAnswerSignature,
  visibleQuestions,
} from "@/lib/survey-logic";
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
  const visibleCacheRef = useRef<{
    survey: Survey;
    signature: string;
    visible: ReturnType<typeof visibleQuestions>;
  } | null>(null);
  const visibilitySignature = visibilityAnswerSignature(survey, answers);
  const visible = useMemo(() => {
    const cached = visibleCacheRef.current;
    if (cached && cached.survey === survey && cached.signature === visibilitySignature) {
      return cached.visible;
    }
    const next = visibleQuestions(survey, answers);
    visibleCacheRef.current = { survey, signature: visibilitySignature, visible: next };
    return next;
  }, [answers, survey, visibilitySignature]);
  const pct = useMemo(() => progressForVisible(visible, answers), [answers, visible]);
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
