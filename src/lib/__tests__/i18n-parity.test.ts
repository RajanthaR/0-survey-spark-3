import { describe, expect, it } from "vitest";

import { UI, type LocalizedString } from "@/lib/i18n";

function valuesFor(key: string, value: LocalizedString | LocalizedString[]) {
  return Array.isArray(value)
    ? value.map((item, index) => [`${key}[${index}]`, item] as const)
    : [[key, value] as const];
}

describe("UI dictionary parity", () => {
  it("has non-empty English, Sinhala, and Tamil text for every UI entry", () => {
    const missing: string[] = [];

    for (const [key, value] of Object.entries(UI)) {
      for (const [label, item] of valuesFor(key, value)) {
        for (const lang of ["en", "si", "ta"] as const) {
          if (!item[lang]?.trim()) missing.push(`${label}.${lang}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
