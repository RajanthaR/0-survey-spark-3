/**
 * Guardrail: question-count / question-position copy must always go through
 * the helpers in src/lib/format.ts (or the QuestionCount / QuestionPosition
 * components). This scan walks the source tree and fails if any file
 * reintroduces hardcoded Sinhala / Tamil / English count strings.
 *
 * Allowed homes for the literal strings:
 *   - src/lib/format.ts            (the helpers themselves)
 *   - src/components/QuestionCount.tsx
 *   - this test file
 *   - any file under src/**\/__tests__/ or *.test.ts(x) (snapshots, fixtures)
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");

const ALLOWED = new Set(
  [
    "src/lib/format.ts",
    "src/components/QuestionCount.tsx",
    "src/lib/__tests__/no-hardcoded-question-strings.test.ts",
  ].map((p) => p.split("/").join(sep)),
);

const SCAN_EXT = /\.(ts|tsx|js|jsx)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Skip generated and snapshot folders.
      if (name === "node_modules" || name === "__snapshots__") continue;
      walk(full, out);
    } else if (SCAN_EXT.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const SINHALA_NOUN = "ප්‍රශ්න"; // includes ZWJ
const TAMIL_NOUN = "கேள்விகள்";

// Patterns that indicate a hardcoded count/position rather than helper output.
const PATTERNS: { name: string; re: RegExp }[] = [
  // English: "39 questions", "1 question"
  { name: "en count (\"N question(s)\")", re: /\b\d+\s+questions?\b/i },
  // English: "Question 3 of 39"
  { name: "en position (\"Question N of M\")", re: /\bQuestion\s+\d+\s+of\s+\d+\b/i },
  // Sinhala: "ප්‍රශ්න 39" or "ප්‍රශ්න 3 / 39"
  {
    name: "si count/position (\"ප්‍රශ්න N…\")",
    re: new RegExp(`${SINHALA_NOUN}\\s*\\d`),
  },
  // Tamil: "கேள்விகள் 39" or "கேள்விகள் 3 / 39"
  {
    name: "ta count/position (\"கேள்விகள் N…\")",
    re: new RegExp(`${TAMIL_NOUN}\\s*\\d`),
  },
];

describe("no hardcoded question count/position strings", () => {
  const files = walk(SRC);

  it("scan covers a meaningful chunk of the source tree", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const { name, re } of PATTERNS) {
    it(`no file reintroduces ${name}`, () => {
      const offenders: string[] = [];
      for (const file of files) {
        const rel = relative(process.cwd(), file);
        if (ALLOWED.has(rel)) continue;
        // Skip co-located tests/snapshots/fixtures.
        if (rel.includes(`${sep}__tests__${sep}`)) continue;
        if (/\.test\.(ts|tsx|js|jsx)$/.test(rel)) continue;

        const src = readFileSync(file, "utf8");
        const m = src.match(re);
        if (m) {
          // Report file + first matching line for fast triage.
          const idx = src.indexOf(m[0]);
          const line = src.slice(0, idx).split("\n").length;
          offenders.push(`${rel}:${line} → ${m[0]}`);
        }
      }
      expect(
        offenders,
        `Hardcoded ${name} found. Use formatQuestionCount/formatQuestionPosition or the QuestionCount/QuestionPosition components instead:\n  ${offenders.join("\n  ")}`,
      ).toEqual([]);
    });
  }
});
