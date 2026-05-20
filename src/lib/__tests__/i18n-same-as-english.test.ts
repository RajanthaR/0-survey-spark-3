import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { UI, type LocalizedString } from "@/lib/i18n";
import { DATE_I18N } from "@/lib/analytics-report-i18n";
import { CONSENT_ITEMS, STUDY_META } from "@/surveys/consent";
import { SURVEY_LIST } from "@/surveys";
import { LIKERT_5, YES_NO_OPTIONS } from "@/surveys/types";

type Finding = {
  path: string;
  lang: "si" | "ta";
  value: string;
};

type Report = {
  generatedAt: string;
  total: number;
  files: Record<string, Finding[]>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isLocalizedString(value: unknown): value is Required<LocalizedString> {
  return (
    isRecord(value) &&
    typeof value.en === "string" &&
    typeof value.si === "string" &&
    typeof value.ta === "string"
  );
}

function collectLocalizedStrings(
  value: unknown,
  path: string,
  out: Array<[string, Required<LocalizedString>]>,
) {
  if (isLocalizedString(value)) {
    out.push([path, value]);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectLocalizedStrings(item, `${path}[${index}]`, out));
    return;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      collectLocalizedStrings(item, path ? `${path}.${key}` : key, out);
    }
  }
}

function addFindings(report: Report, file: string, root: unknown) {
  const strings: Array<[string, Required<LocalizedString>]> = [];
  collectLocalizedStrings(root, "", strings);

  for (const [path, value] of strings) {
    for (const lang of ["si", "ta"] as const) {
      if (value[lang] !== value.en) continue;
      report.files[file] ??= [];
      report.files[file].push({ path, lang, value: value.en });
      report.total += 1;
    }
  }
}

describe("same-as-English i18n review report", () => {
  it("writes a non-gating grouped report for translator review", () => {
    const report: Report = {
      generatedAt: new Date().toISOString(),
      total: 0,
      files: {},
    };

    addFindings(report, "src/lib/i18n.tsx", UI);
    addFindings(report, "src/lib/analytics-report-i18n.ts", DATE_I18N);
    addFindings(report, "src/surveys/consent.ts", { STUDY_META, CONSENT_ITEMS });
    addFindings(report, "src/surveys/types.ts", { YES_NO_OPTIONS, LIKERT_5 });
    for (const survey of SURVEY_LIST) {
      addFindings(report, `src/surveys/${survey.slug}.ts`, survey);
    }

    const outPath = join(process.cwd(), "coverage", "same-as-english.json");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

    expect(report).toHaveProperty("files");
  });
});
