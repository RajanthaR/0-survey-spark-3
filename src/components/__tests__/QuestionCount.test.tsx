import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider, useLang, type Lang } from "@/lib/i18n";
import { QuestionCount, QuestionPosition } from "@/components/QuestionCount";
import { useEffect } from "react";

function SetLang({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const { setLang } = useLang();
  useEffect(() => {
    setLang(lang);
  }, [lang, setLang]);
  return <>{children}</>;
}

function renderWithLang(ui: React.ReactNode, lang: Lang) {
  return render(
    <I18nProvider>
      <SetLang lang={lang}>{ui}</SetLang>
    </I18nProvider>,
  );
}

// Multiple "surveys" — different question totals.
const SURVEYS = [
  { slug: "phase-1", total: 39 },
  { slug: "phase-3", total: 22 },
  { slug: "tiny-pilot", total: 1 },
];

describe("QuestionCount across languages and surveys", () => {
  for (const s of SURVEYS) {
    it(`English subtitle for ${s.slug} (${s.total})`, () => {
      const { unmount } = renderWithLang(<QuestionCount count={s.total} lang="en" />, "en");
      expect(screen.getByTestId("question-count").textContent).toBe(`${s.total} questions`);
      unmount();
    });

    it(`Sinhala subtitle for ${s.slug} (${s.total}) — "ප්‍රශ්න N"`, () => {
      const { unmount } = renderWithLang(<QuestionCount count={s.total} lang="si" />, "si");
      const node = screen.getByTestId("question-count");
      expect(node.textContent).toBe(`ප්‍රශ්න ${s.total}`);
      // explicit guard: the broken legacy ordering must not appear
      expect(node.textContent).not.toMatch(/^\d/);
      expect(node.textContent).not.toContain("ප්‍රශ්නය");
      unmount();
    });

    it(`Tamil subtitle for ${s.slug} (${s.total}) — "கேள்விகள் N"`, () => {
      const { unmount } = renderWithLang(<QuestionCount count={s.total} lang="ta" />, "ta");
      const node = screen.getByTestId("question-count");
      expect(node.textContent).toBe(`கேள்விகள் ${s.total}`);
      expect(node.textContent).not.toMatch(/^\d/);
      unmount();
    });
  }
});

describe("QuestionPosition (progress header) across languages", () => {
  it("English: 'Question 3 of 39'", () => {
    renderWithLang(<QuestionPosition current={3} total={39} lang="en" announce />, "en");
    const node = screen.getByTestId("question-position");
    expect(node.textContent).toBe("Question 3 of 39");
    expect(node.getAttribute("aria-live")).toBe("polite");
    expect(node.getAttribute("role")).toBe("status");
  });

  it("Sinhala: noun-first 'ප්‍රශ්න 3 / 39'", () => {
    renderWithLang(<QuestionPosition current={3} total={39} lang="si" announce />, "si");
    const node = screen.getByTestId("question-position");
    expect(node.textContent).toBe("ප්‍රශ්න 3 / 39");
    expect(node.textContent?.startsWith("ප්‍රශ්න")).toBe(true);
  });

  it("Tamil: noun-first 'கேள்விகள் 3 / 39'", () => {
    renderWithLang(<QuestionPosition current={3} total={39} lang="ta" announce />, "ta");
    const node = screen.getByTestId("question-position");
    expect(node.textContent).toBe("கேள்விகள் 3 / 39");
    expect(node.textContent?.startsWith("கேள்விகள்")).toBe(true);
  });

  it("aria-live is omitted unless announce is set", () => {
    renderWithLang(<QuestionPosition current={1} total={5} lang="en" />, "en");
    const node = screen.getByTestId("question-position");
    expect(node.getAttribute("aria-live")).toBeNull();
    expect(node.getAttribute("role")).toBeNull();
  });
});
