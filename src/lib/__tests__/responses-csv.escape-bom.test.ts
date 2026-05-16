import { describe, it, expect } from "vitest";
import {
  escapeCsvCell,
  buildResponsesCsv,
  type ResponseRow,
} from "../responses-csv";

/**
 * RFC-4180-ish CSV escaping + UTF-8 BOM handling.
 *
 * `escapeCsvCell` only quotes when a cell contains `,`, `"`, or `\n`, and
 * doubles any embedded `"`. The BOM (`\uFEFF`) is prepended by the caller
 * (admin.tsx ZIP export path) to force Excel into UTF-8; these tests pin
 * both behaviors so a future refactor can't silently change either.
 */

const BOM = "\uFEFF";

describe("escapeCsvCell — passthrough cases (no quoting)", () => {
  it("returns empty string for null and undefined", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("leaves plain ASCII without delimiters unquoted", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
    expect(escapeCsvCell("hello world")).toBe("hello world");
    expect(escapeCsvCell("a-b_c.d")).toBe("a-b_c.d");
  });

  it("stringifies primitives without quoting", () => {
    expect(escapeCsvCell(0)).toBe("0");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(-1.5)).toBe("-1.5");
    expect(escapeCsvCell(true)).toBe("true");
    expect(escapeCsvCell(false)).toBe("false");
  });

  it("preserves multibyte UTF-8 characters as-is", () => {
    // Sinhala + Tamil + emoji — none are CSV-significant.
    expect(escapeCsvCell("සිංහල")).toBe("සිංහල");
    expect(escapeCsvCell("தமிழ்")).toBe("தமிழ்");
    expect(escapeCsvCell("🚀✨")).toBe("🚀✨");
  });
});

describe("escapeCsvCell — must-quote cases", () => {
  it("quotes cells containing a comma", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell(",")).toBe('","');
    expect(escapeCsvCell("Doe, Jane")).toBe('"Doe, Jane"');
  });

  it("quotes cells containing a newline (LF)", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell("\n")).toBe('"\n"');
  });

  it("quotes and doubles embedded double-quotes", () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('"')).toBe('""""');
    expect(escapeCsvCell("\"\"")).toBe("\"\"\"\"\"\"");
  });

  it("handles all three delimiters in one cell", () => {
    // commas + quotes + newline all present
    const input = 'a,"b"\nc';
    // → must quote, double the inner ", keep \n and , as-is inside quotes
    expect(escapeCsvCell(input)).toBe('"a,""b""\nc"');
  });

  it("does NOT quote a bare CR (only \\n triggers quoting)", () => {
    // Documents current behavior — CR alone slips through unquoted.
    expect(escapeCsvCell("a\rb")).toBe("a\rb");
  });
});

describe("escapeCsvCell — object/array values", () => {
  it("JSON-encodes objects and quotes the result (contains commas/quotes)", () => {
    expect(escapeCsvCell({ a: 1, b: "x" })).toBe('"{""a"":1,""b"":""x""}"');
  });

  it("JSON-encodes arrays and quotes the result", () => {
    expect(escapeCsvCell([1, 2, 3])).toBe('"[1,2,3]"');
    expect(escapeCsvCell(["a", "b"])).toBe('"[""a"",""b""]"');
  });

  it("JSON-encodes empty containers without quoting (no CSV-special chars)", () => {
    expect(escapeCsvCell({})).toBe("{}");
    expect(escapeCsvCell([])).toBe("[]");
  });
});

describe("UTF-8 BOM handling", () => {
  it("BOM is a single code unit (U+FEFF)", () => {
    expect(BOM).toHaveLength(1);
    expect(BOM.charCodeAt(0)).toBe(0xfeff);
  });

  it("BOM-prefixed CSV encodes to the canonical EF BB BF byte sequence", () => {
    const bytes = new TextEncoder().encode(BOM + "id,name\n1,a");
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    // Body bytes follow the BOM unchanged. (TextDecoder strips a leading
    // BOM by default — pass ignoreBOM so we observe the raw round-trip.)
    expect(
      new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes),
    ).toBe(BOM + "id,name\n1,a");
  });

  it("BOM does not corrupt downstream CSV parsing of the first cell", () => {
    // A naive parser that strips one leading BOM should recover the header
    // exactly. We don't ship a CSV parser; assert the contract directly.
    const csv = BOM + "id,name\n1,a";
    const stripped = csv.startsWith(BOM) ? csv.slice(1) : csv;
    expect(stripped.split("\n")[0].split(",")).toEqual(["id", "name"]);
  });

  it("buildResponsesCsv output is BOM-free (callers prepend it themselves)", () => {
    const { csv } = buildResponsesCsv(
      [
        {
          id: "r1",
          status: "submitted",
          language: "en",
          progress_pct: 100,
          started_at: "2026-01-01T00:00:00Z",
          completed_at: "2026-01-01T00:01:00Z",
          contact: { name: "Jane", email: "j@x.io", organization: "Org" },
          answers: { q1: "ok" },
        },
      ],
      "demo",
    );
    expect(csv.startsWith(BOM)).toBe(false);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
  });
});

describe("buildResponsesCsv — escaping in real rows", () => {
  const rows: ResponseRow[] = [
    {
      id: "r1",
      status: "submitted",
      language: "en",
      progress_pct: 100,
      started_at: "2026-01-01T00:00:00Z",
      completed_at: "2026-01-01T00:01:00Z",
      contact: {
        name: "Doe, Jane",
        email: 'jane"@example.com',
        organization: "Line1\nLine2",
      },
      answers: {
        q_text: 'He said "hello, world"',
        q_multiline: "first\nsecond",
        q_obj: { tags: ["a,b", 'c"d'] },
      },
    },
  ];

  it("quotes commas in contact_name", () => {
    const { csv } = buildResponsesCsv(rows, "demo");
    expect(csv).toContain('"Doe, Jane"');
  });

  it("doubles embedded quotes in contact_email", () => {
    const { csv } = buildResponsesCsv(rows, "demo");
    expect(csv).toContain('"jane""@example.com"');
  });

  it("quotes newlines in contact_org without breaking row count", () => {
    const { csv } = buildResponsesCsv(rows, "demo");
    expect(csv).toContain('"Line1\nLine2"');
    // 1 header + 1 body row, but the body row carries two quoted \n chars
    // (contact_org and q_multiline), so a naive split("\n") sees 4 parts.
    // The point: those embedded \n live inside `"…"`, not as row separators.
    expect(csv.split("\n")).toHaveLength(4);
    // Exactly one row separator (header → body) is unquoted.
    const headerLen = csv.indexOf("\n");
    expect(headerLen).toBeGreaterThan(0);
    expect(csv.slice(0, headerLen)).not.toContain('"');
  });

  it("escapes free-text answers with quotes and commas", () => {
    const { csv } = buildResponsesCsv(rows, "demo");
    expect(csv).toContain('"He said ""hello, world"""');
  });

  it("JSON-encodes object answers and escapes the resulting quotes", () => {
    const { csv } = buildResponsesCsv(rows, "demo");
    // {"tags":["a,b","c\"d"]} → all internal " doubled, whole cell quoted.
    expect(csv).toContain(
      '"{""tags"":[""a,b"",""c\\""d""]}"',
    );
  });

  it("emits empty cells for null/missing answers without breaking column count", () => {
    const { csv } = buildResponsesCsv(
      [
        {
          id: "r1",
          status: "submitted",
          language: "en",
          progress_pct: 100,
          started_at: "2026-01-01T00:00:00Z",
          completed_at: null,
          contact: null,
          answers: { q_a: "x", q_b: null },
        },
      ],
      "demo",
    );
    const [header, body] = csv.split("\n");
    expect(header.split(",")).toHaveLength(body.split(",").length);
  });
});
