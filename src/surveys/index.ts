import { phase1 } from "./phase-1";
import { phase3 } from "./phase-3";
import type { Survey } from "./types";
import { assertSurveyVisualInvariants } from "./validate";

export const SURVEYS: Record<string, Survey> = {
  "phase-1": phase1,
  "phase-3": phase3,
};

export function getSurvey(slug: string): Survey | null {
  return SURVEYS[slug] ?? null;
}

export const SURVEY_LIST: Survey[] = [phase1, phase3];

// Validate at module load. Throws in dev, logs in prod.
assertSurveyVisualInvariants(SURVEY_LIST);
