import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}));

vi.mock("mermaid", () => ({
  default: mermaidMock,
}));

import { MermaidBlock } from "@/about/components/MermaidBlock";

describe("MermaidBlock", () => {
  beforeEach(() => {
    mermaidMock.initialize.mockReset();
    mermaidMock.render.mockReset();
  });

  it("shows source before hydration render completes, then renders SVG", async () => {
    mermaidMock.render.mockResolvedValue({ svg: '<svg role="img" aria-label="diagram"></svg>' });
    const source = "graph TD; A-->B";
    const { container } = render(<MermaidBlock source={source} />);

    expect(screen.getByTestId("mermaid-source")).toHaveTextContent(source);

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));
    expect(mermaidMock.render.mock.calls[0][1]).toBe(source);
    expect(mermaidMock.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ startOnLoad: false }),
    );
    await waitFor(() => expect(container.querySelector("svg")).not.toBeNull());
  });

  it("renders a fallback when Mermaid parsing fails", async () => {
    mermaidMock.render.mockRejectedValue(new Error("bad diagram"));
    const source = "graph nope";
    render(<MermaidBlock source={source} />);

    expect(screen.getByTestId("mermaid-source")).toHaveTextContent(source);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("bad diagram"));
    expect(screen.getByTestId("mermaid-source")).toHaveTextContent(source);
  });
});
