import type { PairwiseCriterion, Question } from "@/surveys/types";

export type PairwiseSide = "a" | "b";

export type PairwisePair = {
  a: string;
  b: string;
};

export const PAIRWISE_RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const PAIRWISE_COMPLETE_RE = /^[ab][1-9]$/;

export function buildPairwisePairs(criteria: PairwiseCriterion[] = []): PairwisePair[] {
  const pairs: PairwisePair[] = [];
  for (let i = 0; i < criteria.length; i++) {
    for (let j = i + 1; j < criteria.length; j++) {
      pairs.push({ a: criteria[i].key, b: criteria[j].key });
    }
  }
  return pairs;
}

export function pairwiseKey(pair: PairwisePair): string {
  return `${pair.a}__${pair.b}`;
}

export function parsePairwiseCode(code: unknown): {
  side: PairwiseSide | null;
  rating: number | null;
  complete: boolean;
} {
  if (typeof code !== "string") return { side: null, rating: null, complete: false };
  if (code === "a" || code === "b") return { side: code, rating: null, complete: false };
  if (!PAIRWISE_COMPLETE_RE.test(code)) return { side: null, rating: null, complete: false };
  return { side: code[0] as PairwiseSide, rating: Number(code[1]), complete: true };
}

export function isPairwiseCodeComplete(code: unknown): boolean {
  return parsePairwiseCode(code).complete;
}

export function pairwiseAllPairsComplete(q: Question, value: unknown): boolean {
  const pairs = buildPairwisePairs(q.criteria);
  const obj = (value ?? {}) as Record<string, unknown>;
  for (const pair of pairs) {
    if (!isPairwiseCodeComplete(obj[pairwiseKey(pair)])) return false;
  }
  return true;
}

export function countPairwiseCompletePairs(q: Question, value: unknown): number {
  const obj = (value ?? {}) as Record<string, unknown>;
  return buildPairwisePairs(q.criteria).filter((pair) =>
    isPairwiseCodeComplete(obj[pairwiseKey(pair)]),
  ).length;
}
