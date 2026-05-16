/**
 * Verifies that SurveyRunner renders the localized <QuestionCount> (intro
 * estimate) and <QuestionPosition> (live progress) components correctly in
 * every supported language. Guards against any regression that bypasses the
 * helpers and reintroduces hardcoded English copy.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { I18nProvider, useLang, type Lang } from "@/lib/i18n";
import { formatQuestionCount, formatQuestionPosition } from "@/lib/format";
import type { Survey } from "@/surveys/types";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));
vi.mock("@/lib/responses.functions", () => ({
  startResponse: vi.fn().mockResolvedValue({ resumeToken: "tok" }),
  saveAnswers: vi.fn().mockResolvedValue({}),
  completeResponse: vi.fn().mockResolvedValue({}),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(() => {}, { success: () => {}, error: () => {} }),
}));
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const passthrough = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) =>
      React.createElement(tag, { ...props, ref }),
    );
  return {
    motion: new Proxy({}, { get: (_t, key: string) => passthrough(key) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => false,
  };
});

import { SurveyRunner } from "@/components/SurveyRunner";

const SURVEY: Survey = {
  slug: "e2e-i18n",
  title: { en: "E2E", si: "අත්හදා බැලීම", ta: "சோதனை" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: Array.from({ length: 3 }, (_, i) => ({
    id: `q${i + 1}`,
    type: "text" as const,
    section: { en: "S", si: "S", ta: "S" },
    label: { en: `Q${i + 1}`, si: `Q${i + 1}`, ta: `Q${i + 1}` },
    required: true,
  })),
};

function SetLang({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const { setLang } = useLang();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLang(lang); }, []);
  return <>{children}</>;
}

function renderRunner(lang: Lang, withToken: boolean) {
  return render(
    <I18nProvider>
      <SetLang lang={lang}>
        <SurveyRunner
          survey={SURVEY}
          initialToken={withToken ? "tok" : undefined}
          initialLanguage={lang}
        />
      </SetLang>
    </I18nProvider>,
  );
}

const LANGS: Lang[] = ["en", "si", "ta"];

const EXPECTED: Record<Lang, { count: string; position: string }> = {
  en: { count: "3 questions", position: "Question 1 of 3" },
  si: { count: "ප්‍රශ්න 3", position: "ප්‍රශ්න 1 / 3" },
  ta: { count: "கேள்விகள் 3", position: "கேள்விகள் 1 / 3" },
};

describe("SurveyRunner localized question count + position", () => {
  describe("QuestionCount on the intro screen", () => {
    for (const lang of LANGS) {
      it(`renders the localized total in ${lang}`, async () => {
        renderRunner(lang, false);
        const count = await screen.findByTestId("question-count");
        expect(count.getAttribute("data-lang")).toBe(lang);
        const text = count.textContent?.trim();
        expect(text).toBe(formatQuestionCount(SURVEY.questions.length, lang));
        // Cross-check against the canonical noun-ordering rule.
        expect(text).toBe(EXPECTED[lang].count);
      });
    }
  });

  describe("QuestionPosition on the live progress header", () => {
    for (const lang of LANGS) {
      it(`renders the localized position in ${lang}`, async () => {
        renderRunner(lang, true);
        const pos = await screen.findByTestId("question-position");
        expect(pos.getAttribute("data-lang")).toBe(lang);
        const text = pos.textContent?.trim();
        expect(text).toBe(
          formatQuestionPosition(1, SURVEY.questions.length, lang),
        );
        expect(text).toBe(EXPECTED[lang].position);
      });
    }
  });
});
