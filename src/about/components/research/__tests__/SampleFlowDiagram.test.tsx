import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/about/components/MermaidBlock", () => ({
  MermaidBlock: ({ source }: { source: string }) => <div data-testid="mermaid-block">{source}</div>,
}));

import { SampleFlowDiagram, sampleFlowSource } from "@/about/components/research/SampleFlowDiagram";

describe("SampleFlowDiagram", () => {
  it("keeps a non-empty Mermaid source with expected participant-flow nodes", () => {
    expect(sampleFlowSource).toContain("Lands on /");
    expect(sampleFlowSource).toContain("Reads consent");
    expect(sampleFlowSource).toContain("Supabase responses");

    render(<SampleFlowDiagram />);
    expect(screen.getByTestId("mermaid-block")).toHaveTextContent("Final submit");
  });
});
