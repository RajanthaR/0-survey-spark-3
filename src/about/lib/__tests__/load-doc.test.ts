import { describe, expect, it } from "vitest";

import {
  buildDocSearchIndex,
  extractHeadings,
  extractMarkdownTitle,
  listDocs,
  loadDoc,
} from "@/about/lib/load-doc";

describe("loadDoc", () => {
  it("loads tracked Markdown by repo-relative path", () => {
    const source = loadDoc("docs/DEPLOYMENT.md");

    expect(source).toBeTruthy();
    expect(source?.trimStart()).toMatch(/^#\s+/);
  });

  it("lists Markdown documents under a prefix", () => {
    expect(listDocs("audits/").length).toBeGreaterThanOrEqual(12);
  });

  it("returns undefined for unknown paths", () => {
    expect(loadDoc("docs/does-not-exist.md")).toBeUndefined();
  });
});

describe("Markdown search metadata", () => {
  it("uses the first h1 as the title", () => {
    expect(extractMarkdownTitle("# First title\n\n# Second title", "docs/fallback.md")).toBe(
      "First title",
    );
  });

  it("falls back to a readable filename", () => {
    expect(extractMarkdownTitle("No heading here", "docs/example-file_name.md")).toBe(
      "Example File Name",
    );
  });

  it("builds an index that includes title and headings", () => {
    const index = buildDocSearchIndex();
    const deployment = index.find((entry) => entry.path === "docs/DEPLOYMENT.md");

    expect(deployment).toBeTruthy();
    expect(deployment?.title).toMatch(/\S/);
    expect(deployment?.searchText).toContain("deployment");
  });

  it("ignores heading-like comments inside fenced code blocks", () => {
    expect(
      extractHeadings(
        [
          "# Real title",
          "",
          "```bash",
          "# not a heading",
          "## also not a heading",
          "```",
          "",
          "## Real section",
        ].join("\n"),
      ),
    ).toEqual(["Real title", "Real section"]);
  });
});
