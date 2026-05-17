import { describe, it, expect } from "vitest";
import { sanitizeCsvChunk, validateAssembledCsv } from "../csv-continuity";

const HEADER = "id,name,age";

describe("sanitizeCsvChunk", () => {
  it("strips a stray BOM at the start of a chunk", () => {
    expect(sanitizeCsvChunk("\uFEFFa,b,c\n", HEADER)).toBe("a,b,c\n");
  });

  it("drops a re-emitted header line on a resumed page", () => {
    const chunk = `${HEADER}\n1,alice,30\n`;
    expect(sanitizeCsvChunk(chunk, HEADER)).toBe("1,alice,30\n");
  });

  it("guarantees a trailing newline so page boundaries don't fuse rows", () => {
    expect(sanitizeCsvChunk("1,alice,30", HEADER)).toBe("1,alice,30\n");
  });

  it("leaves a clean chunk untouched", () => {
    expect(sanitizeCsvChunk("1,alice,30\n", HEADER)).toBe("1,alice,30\n");
  });

  it("returns an empty string when the chunk is exactly the header (no rows)", () => {
    expect(sanitizeCsvChunk(HEADER, HEADER)).toBe("");
  });
});

describe("validateAssembledCsv", () => {
  const ok = (chunks: string[]) => validateAssembledCsv(chunks, HEADER);

  it("accepts a well-formed assembly", () => {
    const result = ok(["\uFEFF", `${HEADER}\n`, "1,alice,30\n", "2,bob,28\n"]);
    expect(result).toEqual({ ok: true });
  });

  it("rejects a missing BOM", () => {
    const result = ok([`${HEADER}\n`, "1,alice,30\n"]);
    expect(result).toMatchObject({ ok: false, reason: "missing leading BOM" });
  });

  it("rejects a duplicate BOM", () => {
    const result = ok(["\uFEFF", `${HEADER}\n`, "\uFEFF1,alice,30\n"]);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toMatch(/multiple BOM/);
  });

  it("rejects a duplicated header line mid-stream", () => {
    const result = ok(["\uFEFF", `${HEADER}\n`, "1,alice,30\n", `${HEADER}\n`, "2,bob,28\n"]);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toMatch(/duplicate header/);
  });

  it("rejects a final row without trailing newline", () => {
    const result = ok(["\uFEFF", `${HEADER}\n`, "1,alice,30"]);
    expect(result).toMatchObject({ ok: false, reason: "final row not newline-terminated" });
  });
});
