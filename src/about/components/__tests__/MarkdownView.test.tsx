import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/about/components/MermaidBlock", () => ({
  MermaidBlock: ({ source }: { source: string }) => <div data-testid="mermaid-block">{source}</div>,
}));

import { MarkdownView, rewriteMarkdownHref } from "@/about/components/MarkdownView";

describe("MarkdownView", () => {
  it("renders GFM tables, task lists, and Mermaid fences", () => {
    render(
      <MarkdownView
        basePath="docs/plans/option-visuals.md"
        source={[
          "# Rendered doc",
          "",
          "- [x] Done",
          "",
          "| A | B |",
          "| - | - |",
          "| 1 | 2 |",
          "",
          "```mermaid",
          "graph TD; A-->B",
          "```",
        ].join("\n")}
      />,
    );

    expect(screen.getByRole("heading", { name: "Rendered doc" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByTestId("mermaid-block")).toHaveTextContent("graph TD; A-->B");
  });

  it("rewrites Markdown docs in-app, source links to GitHub, and leaves external links unchanged", () => {
    render(
      <MarkdownView
        basePath="docs/plans/option-visuals.md"
        source={[
          "[Deployment](../DEPLOYMENT.md)",
          "[Source](/src/server.ts)",
          "[External](https://example.com)",
          "[Anchor](#local)",
        ].join(" ")}
      />,
    );

    expect(screen.getByRole("link", { name: "Deployment" })).toHaveAttribute(
      "href",
      "/about/engineering?mode=browser&doc=docs%2FDEPLOYMENT.md",
    );
    expect(screen.getByRole("link", { name: "Source" })).toHaveAttribute(
      "href",
      "https://github.com/RajanthaR/survey-spark-3/blob/main/src/server.ts",
    );
    expect(screen.getByRole("link", { name: "External" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(screen.getByRole("link", { name: "Anchor" })).toHaveAttribute("href", "#local");
  });
});

describe("rewriteMarkdownHref", () => {
  it("normalizes nested relative paths", () => {
    expect(rewriteMarkdownHref("./nested/../DEPLOYMENT.md#railway", "docs/plans/current.md")).toBe(
      "/about/engineering?mode=browser&doc=docs%2Fplans%2FDEPLOYMENT.md#railway",
    );
  });

  it("rewrites cross-audit Markdown links into the doc browser", () => {
    expect(rewriteMarkdownHref("04-testing.md#t-6", "audits/00-overview.md")).toBe(
      "/about/engineering?mode=browser&doc=audits%2F04-testing.md#t-6",
    );
  });
});
