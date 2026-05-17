import { describe, expect, it } from "vitest";
import { computeDropoff } from "../DropoffChart";

describe("computeDropoff", () => {
  it("derives per-question drop-off from answered percentages", () => {
    const { rows, steepestIndex } = computeDropoff([
      { id: "q1", label: "Q1", answeredPct: 95 },
      { id: "q2", label: "Q2", answeredPct: 90 },
      { id: "q3", label: "Q3", answeredPct: 40 },
      { id: "q4", label: "Q4", answeredPct: 38 },
    ]);
    expect(rows.map((r) => r.dropPct)).toEqual([5, 5, 50, 2]);
    expect(steepestIndex).toBe(2);
    expect(rows[steepestIndex].id).toBe("q3");
  });

  it("clamps negative deltas (later question can't legitimately exceed earlier)", () => {
    const { rows } = computeDropoff([
      { id: "q1", label: "Q1", answeredPct: 80 },
      { id: "q2", label: "Q2", answeredPct: 85 },
    ]);
    expect(rows[1].dropPct).toBe(0);
  });

  it("treats the first question's miss as drop from 100%", () => {
    const { rows } = computeDropoff([{ id: "q1", label: "Q1", answeredPct: 70 }]);
    expect(rows[0].dropPct).toBe(30);
  });
});
