import { describe, expect, it } from "vitest";

import { parseMasterTodo, sortAuditItems, type AuditItem } from "@/about/lib/audit-parser";

describe("parseMasterTodo", () => {
  it("parses Codex task-list items with checked and in-progress states", () => {
    const items = parseMasterTodo(
      [
        "## Phase 3 - Test And CI Reliability",
        "- [x] Created `05-testing-audit.md`.",
        "- [~] T-6 Add typecheck gate. _(high)_",
        "- [ ] Unknown line should not matter.",
        "plain text ignored",
      ].join("\n"),
      "codex-audits",
    );

    expect(items).toEqual([
      expect.objectContaining({
        origin: "codex-audits",
        status: "done",
        topic: "test and ci reliability",
        sourceFile: "Codex-audits/MASTER_TODO.md",
      }),
      expect.objectContaining({
        id: "T-6",
        status: "in-progress",
        severity: "high",
        topic: "testing",
        sourceFile: "Codex-audits/05-testing-audit.md",
      }),
      expect.objectContaining({
        status: "open",
        title: "Unknown line should not matter.",
      }),
    ]);
  });

  it("parses audits table rows with multiple IDs and source-file mapping", () => {
    const items = parseMasterTodo(
      [
        "## P1 - Sprint 2-3",
        "| # | ID | Title | Effort | Why |",
        "| --- | --- | --- | --- | --- |",
        "| 20 | T-6 / T-7 / T-8 | Add typecheck + lint + test gates. | XS | Stop bleed. |",
        "| 21 | S-1 | Require `TURNSTILE_SECRET` in production. | S | high severity deploy gate. |",
      ].join("\n"),
      "audits",
    );

    expect(items).toEqual([
      expect.objectContaining({
        id: "T-6 / T-7 / T-8",
        status: "open",
        topic: "testing",
        sourceFile: "audits/04-testing.md",
      }),
      expect.objectContaining({
        id: "S-1",
        severity: "high",
        topic: "security",
        sourceFile: "audits/07-security.md",
      }),
    ]);
  });

  it("uses phase headings for ID-less Codex tasks and ignores non-task prose", () => {
    const items = parseMasterTodo(
      [
        "## Phase 1 - Foundation",
        "This line is context, not work.",
        "- [ ] Confirm deployment runbook.",
        "## Phase 2 - Dashboard Work",
        "- [/] Wire audit dashboard.",
      ].join("\n"),
      "codex-audits",
    );

    expect(items).toHaveLength(2);
    expect(items).toEqual([
      expect.objectContaining({
        status: "open",
        topic: "foundation",
        sourceFile: "Codex-audits/MASTER_TODO.md",
      }),
      expect.objectContaining({
        status: "in-progress",
        topic: "dashboard work",
        sourceFile: "Codex-audits/MASTER_TODO.md",
      }),
    ]);
  });
});

describe("sortAuditItems", () => {
  it("sorts by status, severity, then ID", () => {
    const items: AuditItem[] = [
      { origin: "audits", id: "C-3", title: "Done", status: "done", topic: "content" },
      {
        origin: "audits",
        id: "C-2",
        title: "Open low",
        status: "open",
        severity: "low",
        topic: "content",
      },
      {
        origin: "audits",
        id: "C-1",
        title: "Open critical",
        status: "open",
        severity: "critical",
        topic: "content",
      },
      {
        origin: "audits",
        id: "C-4",
        title: "Active",
        status: "in-progress",
        severity: "high",
        topic: "content",
      },
    ];

    expect(sortAuditItems(items).map((item) => item.id)).toEqual(["C-1", "C-2", "C-4", "C-3"]);
  });
});
