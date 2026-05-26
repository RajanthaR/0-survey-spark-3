import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildPhaseTimelineItems, PhaseTimeline } from "@/about/components/research/PhaseTimeline";

describe("PhaseTimeline", () => {
  it("builds metadata from the canonical survey list", () => {
    const items = buildPhaseTimelineItems();

    expect(items.map((item) => item.slug)).toEqual(["phase-1", "phase-3"]);
    expect(items[0].questionCount).toBeGreaterThan(20);
    expect(items[0].sections).toContain("A. Industry profile");
    expect(items[1].sections[0]).toBe("Respondent information");
    expect(items[1].sections).toContain("H. Documents, contact & authorization");
  });

  it("renders phase stats and live aggregate labels", () => {
    render(
      <PhaseTimeline
        aggregates={{
          generatedAt: "2026-05-26T00:00:00.000Z",
          completed: {
            all: { value: 20, label: "20", masked: false },
            byPhase: {
              "phase-1": { value: 12, label: "12", masked: false },
              "phase-3": { value: null, label: "<10", masked: true },
            },
            byLang: {
              en: { value: 12, label: "12", masked: false },
              si: { value: null, label: "<10", masked: true },
              ta: { value: null, label: "<10", masked: true },
            },
          },
          started: {
            all: { value: 30, label: "30", masked: false },
            byPhase: {
              "phase-1": { value: 15, label: "15", masked: false },
              "phase-3": { value: 15, label: "15", masked: false },
            },
            byLang: {
              en: { value: 20, label: "20", masked: false },
              si: { value: null, label: "<10", masked: true },
              ta: { value: null, label: "<10", masked: true },
            },
          },
          inProgress: {
            all: { value: 10, label: "10", masked: false },
            byPhase: {
              "phase-1": { value: null, label: "<10", masked: true },
              "phase-3": { value: null, label: "<10", masked: true },
            },
            byLang: {
              en: { value: 10, label: "10", masked: false },
              si: { value: null, label: "<10", masked: true },
              ta: { value: null, label: "<10", masked: true },
            },
          },
          lastResponseAgeHours: 2,
        }}
      />,
    );

    expect(screen.getByText(/Phase 1.*Industry Profile/)).toBeInTheDocument();
    expect(screen.getByText(/Phase 3.*Detailed Eco-Industrial Park Survey/)).toBeInTheDocument();
    expect(screen.getAllByText("Started rows: 15")).toHaveLength(2);
    expect(screen.getAllByText("<10").length).toBeGreaterThan(0);
  });
});
