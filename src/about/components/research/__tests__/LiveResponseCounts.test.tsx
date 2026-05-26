import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LiveResponseCountsView } from "@/about/components/research/LiveResponseCounts";

const successState = {
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

describe("LiveResponseCountsView", () => {
  it("renders loading skeletons", () => {
    render(<LiveResponseCountsView state={{ status: "loading" }} />);

    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders a muted error state", () => {
    render(
      <LiveResponseCountsView
        state={{ status: "error", error: new Error("database unavailable") }}
      />,
    );

    expect(screen.getByText("Counts unavailable")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("database unavailable");
  });

  it("renders completed, started, in-progress, and masked language splits", () => {
    render(<LiveResponseCountsView state={successState} />);

    expect(screen.getByText("Completed submissions")).toBeInTheDocument();
    expect(screen.getByText("Started responses")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("1 hour ago")).toBeInTheDocument();
    expect(screen.getByText("Completed by language")).toBeInTheDocument();
    expect(screen.getAllByText("<10").length).toBeGreaterThan(1);
  });
});
