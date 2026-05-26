import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/about/components/MermaidBlock", () => ({
  MermaidBlock: ({ source }: { source: string }) => <div data-testid="mermaid-block">{source}</div>,
}));

import { ResearchLaneContent } from "@/routes/about.research";

const aggregateState = {
  status: "success" as const,
  data: {
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
      all: { value: null, label: "<10", masked: true },
      byPhase: {
        "phase-1": { value: null, label: "<10", masked: true },
        "phase-3": { value: null, label: "<10", masked: true },
      },
      byLang: {
        en: { value: null, label: "<10", masked: true },
        si: { value: null, label: "<10", masked: true },
        ta: { value: null, label: "<10", masked: true },
      },
    },
    lastResponseAgeHours: 1,
  },
};

describe("ResearchLaneContent", () => {
  it("composes all five research sections and the right rail nav", () => {
    render(<ResearchLaneContent aggregateState={aggregateState} />);

    expect(
      screen.getByRole("heading", { name: "Methodology, instrument, and progress" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Research question and framework" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Two-phase survey design" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sampling, ethics, and consent" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Milestones" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Research page sections" })).toBeInTheDocument();
    expect(screen.getAllByText("This section is reserved", { exact: false }).length).toBe(2);
    expect(screen.queryByText("CANDIDATE:", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByTestId("mermaid-block")).toHaveTextContent("Aggregate counts");
  });
});
