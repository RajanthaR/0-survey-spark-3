import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MilestoneTimeline, parseMilestones } from "@/about/components/research/MilestoneTimeline";

describe("MilestoneTimeline", () => {
  it("parses the candidate-editable milestone JSON shape", () => {
    expect(
      parseMilestones(
        JSON.stringify([
          { date: "2026-05-26", label: "Data collection mid-point", status: "in-progress" },
        ]),
      ),
    ).toEqual([{ date: "2026-05-26", label: "Data collection mid-point", status: "in-progress" }]);
  });

  it("renders milestone status pills", () => {
    render(
      <MilestoneTimeline
        milestones={[
          { date: "2025-11-01", label: "Proposal defended", status: "done" },
          { date: "2026-05-26", label: "Mid-point", status: "in-progress" },
          { date: "2026-08-01", label: "Phase 3 launch", status: "upcoming" },
        ]}
      />,
    );

    expect(screen.getByText("Proposal defended")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
  });
});
