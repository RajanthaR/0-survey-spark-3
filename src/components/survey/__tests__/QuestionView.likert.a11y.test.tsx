import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { I18nProvider, pickText, type Lang } from "@/lib/i18n";
import { QuestionView } from "@/components/survey/QuestionView";
import { LIKERT_5, type Question } from "@/surveys/types";

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const passthrough = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) =>
      React.createElement(tag, { ...props, ref }),
    );
  return {
    motion: new Proxy({}, { get: (_target, key: string) => passthrough(key) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => false,
  };
});

const Q: Question = {
  id: "likert",
  type: "likert_5",
  section: { en: "Section", si: "අංශය", ta: "பிரிவு" },
  label: { en: "Rate this", si: "මෙය අගයන්න", ta: "இதனை மதிப்பிடவும்" },
  options: LIKERT_5,
};

function renderLikert(lang: Lang) {
  window.localStorage.setItem("eip.lang", lang);
  render(
    <I18nProvider initialLang={lang}>
      <QuestionView q={Q} value={undefined} onChange={() => {}} error={null} />
    </I18nProvider>,
  );
}

describe("QuestionView Likert accessibility", () => {
  it.each(["en", "si", "ta"] as Lang[])(
    "includes localized option text in each Likert aria-label for %s",
    (lang) => {
      renderLikert(lang);

      for (const [index, option] of LIKERT_5.entries()) {
        const n = index + 1;
        expect(
          screen.getByRole("button", { name: `${n}: ${pickText(option.label, lang)}` }),
        ).toBeInTheDocument();
      }
    },
  );
});
