/**
 * Guardrail: any Sinhala / Tamil character anywhere in src/ must live inside
 * one of the allowlisted dictionary files (where translations belong) — never
 * inline in a component, route, or helper. This forces every localized label
 * to go through `pickText` (or the QuestionCount / QuestionPosition helpers,
 * which have their own dedicated scan).
 *
 * If you're adding a new translation home, add it to ALLOWED below with a
 * one-line justification.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");

// Files that are allowed to contain raw Sinhala / Tamil characters.
// Everything else MUST go through pickText against one of these dictionaries.
const ALLOWED = new Set(
  [
    "src/lib/i18n.tsx", // UI string dictionary
    "src/lib/analytics-report-i18n.ts", // Admin analytics-report dictionary
    "src/lib/format.ts", // QuestionCount / QuestionPosition nouns
    "src/surveys/types.ts", // Shared option dictionaries (likert, months, …)
    "src/surveys/consent.ts", // Shared consent items
    "src/surveys/phase-1.ts", // Survey definition
    "src/surveys/phase-3.ts", // Survey definition
    "src/lib/csv-export-shape.ts", // Yes/No option dictionary used by the codebook
    "src/components/QuestionCount.tsx", // JSDoc examples mirror format.ts output
  ].map((p) => p.split("/").join(sep)),
);

const SCAN_EXT = /\.(ts|tsx|js|jsx)$/;
// Sinhala block U+0D80–U+0DFF, Tamil block U+0B80–U+0BFF.
const LOCALIZED_CHAR = /[\u0D80-\u0DFF\u0B80-\u0BFF]/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "__snapshots__") continue;
      walk(full, out);
    } else if (SCAN_EXT.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("no inline Sinhala/Tamil labels outside i18n dictionaries", () => {
  const files = walk(SRC);

  it("scan covers a meaningful chunk of the source tree", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("every localized literal lives in an allowlisted dictionary file", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(process.cwd(), file);
      if (ALLOWED.has(rel)) continue;
      // Skip co-located tests/snapshots/fixtures.
      if (rel.includes(`${sep}__tests__${sep}`)) continue;
      if (/\.test\.(ts|tsx|js|jsx)$/.test(rel)) continue;

      const src = readFileSync(file, "utf8");
      const m = src.match(LOCALIZED_CHAR);
      if (m) {
        const idx = src.search(LOCALIZED_CHAR);
        const line = src.slice(0, idx).split("\n").length;
        const lineText = src.split("\n")[line - 1]?.trim() ?? "";
        offenders.push(`${rel}:${line} → ${lineText.slice(0, 120)}`);
      }
    }
    expect(
      offenders,
      `Inline Sinhala/Tamil characters found outside allowlisted dictionaries. Move the string into a dictionary triple ({ en, si, ta }) in src/lib/i18n.tsx or the survey definition, then render it with pickText:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
