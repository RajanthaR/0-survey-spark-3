import { describe, expect, it } from "vitest";

import { ABOUT_STUDY, ABOUT_STUDY_COPY_KEYS } from "@/about/copy/study";
import { ABOUT_UI, ABOUT_UI_COPY_KEYS, ABOUT_UI_SECTION_IDS } from "@/about/copy/ui";
import type { LocalizedString } from "@/lib/i18n";

type CompleteLocalizedString = Required<LocalizedString>;

const sameAsEnglishAllowed = new Set([
  "ABOUT_STUDY.contactName",
  "ABOUT_STUDY.contactEmail",
  "ABOUT_STUDY.footerForResearchers",
  "ABOUT_STUDY.footerForEngineers",
  "ABOUT_UI.appName",
]);

function isLocalizedString(value: unknown): value is CompleteLocalizedString {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as LocalizedString).en === "string" &&
    typeof (value as LocalizedString).si === "string" &&
    typeof (value as LocalizedString).ta === "string"
  );
}

function collectLocalizedStrings(value: unknown, path: string, out: string[] = []): string[] {
  if (isLocalizedString(value)) {
    out.push(path);
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectLocalizedStrings(item, `${path}[${index}]`, out));
    return out;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      collectLocalizedStrings(child, path ? `${path}.${key}` : key, out);
    }
  }

  return out;
}

function assertCompleteTranslations(root: unknown, rootName: string) {
  const paths = collectLocalizedStrings(root, rootName);
  expect(paths.length).toBeGreaterThan(0);

  for (const path of paths) {
    const value = path
      .replace(`${rootName}.`, "")
      .split(".")
      .reduce<unknown>((current, key) => {
        if (!current || typeof current !== "object") return undefined;
        return (current as Record<string, unknown>)[key];
      }, root);

    expect(isLocalizedString(value), path).toBe(true);
    const localized = value as CompleteLocalizedString;
    expect(localized.en.trim(), `${path}.en`).not.toBe("");
    expect(localized.si.trim(), `${path}.si`).not.toBe("");
    expect(localized.ta.trim(), `${path}.ta`).not.toBe("");

    if (!sameAsEnglishAllowed.has(path)) {
      expect(localized.si, `${path}.si`).not.toBe(localized.en);
      expect(localized.ta, `${path}.ta`).not.toBe(localized.en);
    }
  }
}

describe("about copy dictionaries", () => {
  it("keeps ABOUT_STUDY keys explicit and fully translated", () => {
    expect(Object.keys(ABOUT_STUDY).sort()).toEqual([...ABOUT_STUDY_COPY_KEYS].sort());
    assertCompleteTranslations(ABOUT_STUDY, "ABOUT_STUDY");
  });

  it("keeps ABOUT_UI shell copy explicit and fully translated", () => {
    const topLevelKeys = Object.keys(ABOUT_UI)
      .filter((key) => key !== "sections")
      .sort();
    expect(topLevelKeys).toEqual([...ABOUT_UI_COPY_KEYS].sort());
    expect(Object.keys(ABOUT_UI.sections).sort()).toEqual([...ABOUT_UI_SECTION_IDS].sort());
    assertCompleteTranslations(ABOUT_UI, "ABOUT_UI");
  });
});
