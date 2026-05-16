import { describe, it, expect } from "vitest";
import { detectAlerts, type AlertSnapshot } from "../detect";

const baseQ = (id: string, answeredPct: number, total = 20) => ({
  id,
  label: `Q ${id}`,
  answeredPct,
  total,
});

const snap = (over: Partial<AlertSnapshot> = {}): AlertSnapshot => ({
  surveySlug: "s1",
  total: 50,
  completionRate: 80,
  questions: [baseQ("a", 90), baseQ("b", 85)],
  ...over,
});

describe("detectAlerts", () => {
  it("returns nothing on first snapshot", () => {
    expect(detectAlerts(null, snap())).toEqual([]);
  });

  it("ignores transitions across surveys", () => {
    const prev = snap({ surveySlug: "s1", completionRate: 90 });
    const cur = snap({ surveySlug: "s2", completionRate: 50 });
    expect(detectAlerts(prev, cur)).toEqual([]);
  });

  it("fires completion_drop when completion rate falls >= 10pp", () => {
    const prev = snap({ completionRate: 90 });
    const cur = snap({ completionRate: 78 });
    const alerts = detectAlerts(prev, cur, { now: 1 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("completion_drop");
    expect(alerts[0].severity).toBe("warning");
  });

  it("upgrades completion drops past criticalPp to critical", () => {
    const prev = snap({ completionRate: 90 });
    const cur = snap({ completionRate: 60 });
    const a = detectAlerts(prev, cur, { now: 1 })[0];
    expect(a.kind).toBe("completion_drop");
    expect(a.severity).toBe("critical");
  });

  it("does not fire completion_drop below minResponses", () => {
    const prev = snap({ total: 3, completionRate: 90 });
    const cur = snap({ total: 4, completionRate: 50 });
    expect(detectAlerts(prev, cur)).toEqual([]);
  });

  it("fires skip_spike when a question's answered rate drops >= 15pp", () => {
    const prev = snap({ questions: [baseQ("a", 90), baseQ("b", 85)] });
    const cur = snap({ questions: [baseQ("a", 90), baseQ("b", 60)] });
    const alerts = detectAlerts(prev, cur, { now: 2 });
    const sp = alerts.find((x) => x.kind === "skip_spike");
    expect(sp).toBeTruthy();
    if (sp && sp.kind === "skip_spike") {
      expect(sp.questionId).toBe("b");
      expect(sp.deltaPp).toBeCloseTo(25, 1);
    }
  });

  it("fires absolute skip alert for new questions over the threshold", () => {
    const prev = snap({ questions: [baseQ("a", 90)] });
    const cur = snap({ questions: [baseQ("a", 90), baseQ("c", 30)] });
    const sp = detectAlerts(prev, cur).find((x) => x.kind === "skip_spike");
    expect(sp).toBeTruthy();
    if (sp && sp.kind === "skip_spike") {
      expect(sp.questionId).toBe("c");
      expect(sp.curSkippedPct).toBe(70);
    }
  });

  it("ignores questions below the per-question sample floor", () => {
    const prev = snap({ questions: [baseQ("a", 90, 2)] });
    const cur = snap({ questions: [baseQ("a", 50, 3)] });
    expect(detectAlerts(prev, cur)).toEqual([]);
  });
});
