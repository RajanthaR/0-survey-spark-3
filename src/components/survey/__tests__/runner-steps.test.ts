import { describe, expect, it } from "vitest";

import { getPairwiseStepMeta } from "@/components/survey/runner-steps";

describe("runner step helpers", () => {
  it("handles nullish questions when checking pairwise step metadata", () => {
    expect(getPairwiseStepMeta(null)).toBeNull();
    expect(getPairwiseStepMeta(undefined)).toBeNull();
  });
});
