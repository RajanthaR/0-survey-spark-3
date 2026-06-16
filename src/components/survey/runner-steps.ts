import {
  buildPairwisePairs,
  isPairwiseCodeComplete,
  pairwiseAllPairsComplete,
  pairwiseKey,
  parsePairwiseCode,
  type PairwisePair,
} from "@/lib/pairwise";
import type { Question } from "@/surveys/types";
import { isAnswered as isBaseQuestionAnswered, validateAnswerCode } from "./validation";
import type { ValidationError } from "./validation";

type Answers = Record<string, unknown>;

const PAIRWISE_STEP_SEPARATOR = "::pair::";

export type PairwiseStepMeta = {
  parentId: string;
  pairKey: string;
  pair: PairwisePair;
  index: number;
  total: number;
};

export type SurveyStep = Question & {
  pairwiseStep?: PairwiseStepMeta;
};

function asPairwiseAnswerObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function pairwiseStepId(parentId: string, key: string): string {
  return `${parentId}${PAIRWISE_STEP_SEPARATOR}${key}`;
}

export function expandPairwiseQuestion(question: Question): SurveyStep[] {
  const pairs = buildPairwisePairs(question.criteria);
  return pairs.map((pair, index) => {
    const key = pairwiseKey(pair);
    return {
      ...question,
      id: pairwiseStepId(question.id, key),
      pairwiseStep: {
        parentId: question.id,
        pairKey: key,
        pair,
        index,
        total: pairs.length,
      },
    };
  });
}

export function expandSurveySteps(questions: readonly Question[]): SurveyStep[] {
  const steps: SurveyStep[] = [];
  for (const question of questions) {
    if (question.type === "pairwise_saaty") steps.push(...expandPairwiseQuestion(question));
    else steps.push(question);
  }
  return steps;
}

export function getPairwiseStepMeta(
  question: Question | SurveyStep | null | undefined,
): PairwiseStepMeta | null {
  if (!question || !("pairwiseStep" in question)) return null;
  return question.pairwiseStep ?? null;
}

export function isPairwiseStep(
  question: Question | SurveyStep | null | undefined,
): question is SurveyStep & {
  pairwiseStep: PairwiseStepMeta;
} {
  return getPairwiseStepMeta(question) !== null;
}

export function answerIdForStep(step: SurveyStep): string {
  return step.pairwiseStep?.parentId ?? step.id;
}

export function answerValueForStep(step: SurveyStep, answers: Answers): unknown {
  return answers[answerIdForStep(step)];
}

export function isSurveyStepAnswered(step: SurveyStep, answers: Answers): boolean {
  const meta = getPairwiseStepMeta(step);
  if (meta) {
    const value = asPairwiseAnswerObject(answers[meta.parentId]);
    return isPairwiseCodeComplete(value[meta.pairKey]);
  }
  if (step.type === "pairwise_saaty") {
    return pairwiseAllPairsComplete(step, answers[step.id]);
  }
  return isBaseQuestionAnswered(step, answers);
}

export function validateSurveyStepCode(step: SurveyStep, answers: Answers): ValidationError | null {
  const meta = getPairwiseStepMeta(step);
  if (!meta) return validateAnswerCode(step, answers[step.id]);

  const value = asPairwiseAnswerObject(answers[meta.parentId]);
  const parsed = parsePairwiseCode(value[meta.pairKey]);
  if (!parsed.side || parsed.complete) return null;
  return { code: "ratePairs" };
}

export function progressForSurveySteps(steps: readonly SurveyStep[], answers: Answers): number {
  if (!steps.length) return 0;
  const done = steps.filter((step) => isSurveyStepAnswered(step, answers)).length;
  return Math.round((done / steps.length) * 100);
}

export function resolveStepIdForQuestion(steps: readonly SurveyStep[], id: string): string {
  if (steps.some((step) => step.id === id)) return id;
  return steps.find((step) => step.pairwiseStep?.parentId === id)?.id ?? id;
}
