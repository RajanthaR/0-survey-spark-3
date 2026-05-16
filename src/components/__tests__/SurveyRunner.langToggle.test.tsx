/**
 * Mid-survey language toggle: switching EN ↔ SI ↔ TA on the questions stage
 * must (a) preserve the user's typed answer in state and in the DOM, and
 * (b) re-render every UI string (question label, Back / Save & exit / Next
 * button labels, language pill aria-pressed) in the new language.
 */
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { I18nProvider, UI, pickText, LANGS, type Lang } from "@/lib/i18n";
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
  slug: "lang-toggle",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      section: { en: "Sec", si: "කොටස", ta: "பகுதி" },
      label: {
        en: "What is your role?",
        si: "ඔබේ භූමිකාව කුමක්ද?",
        ta: "உங்கள் பங்கு என்ன?",
      },
      required: false,
    },
  ],
};

const ANSWER = "Sustainability lead — මගේ පිළිතුර";

function renderRunner() {
  return render(
    <I18nProvider>
      <SurveyRunner survey={SURVEY} initialLanguage="en" initialToken="tok" />
    </I18nProvider>,
  );
}

function getInput(): HTMLInputElement {
  const el = document.querySelector('input[type="text"]') as HTMLInputElement | null;
  if (!el) throw new Error("text input not found");
  return el;
}

function getQuestionLabel(lang: Lang): HTMLElement {
  const expected = pickText(SURVEY.questions[0].label, lang);
  const el = Array.from(document.querySelectorAll("h1,h2,h3,p,label,span,div")).find(
    (n) => n.textContent?.trim() === expected,
  ) as HTMLElement | undefined;
  if (!el) throw new Error(`question label "${expected}" not in DOM`);
  return el;
}

function getButtonByAriaLabel(label: string): HTMLButtonElement {
  const btn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.getAttribute("aria-label") === label,
  );
  if (!btn) throw new Error(`button [aria-label="${label}"] not found`);
  return btn;
}

function getLangPill(code: Lang): HTMLButtonElement {
  const meta = LANGS.find((l) => l.code === code);
  if (!meta) throw new Error(`unknown lang ${code}`);
  const btn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.trim() === meta.label,
  );
  if (!btn) throw new Error(`language pill "${meta.label}" not found`);
  return btn;
}

function switchTo(lang: Lang) {
  act(() => {
    getLangPill(lang).click();
  });
}

function assertUiInLang(lang: Lang) {
  // Question label re-renders in target language.
  expect(getQuestionLabel(lang)).toBeTruthy();
  // Action buttons (Back / Save & exit / Next) carry localized aria-labels.
  expect(getButtonByAriaLabel(pickText(UI.back, lang))).toBeTruthy();
  expect(getButtonByAriaLabel(pickText(UI.saveExit, lang))).toBeTruthy();
  // Language pill reflects the active selection via aria-pressed.
  expect(getLangPill(lang).getAttribute("aria-pressed")).toBe("true");
  for (const other of (["en", "si", "ta"] as const).filter((l) => l !== lang)) {
    expect(getLangPill(other).getAttribute("aria-pressed")).toBe("false");
  }
}

describe("SurveyRunner — mid-survey language toggle preserves answers", () => {
  it("switching EN → SI → TA → EN keeps the typed answer and updates every UI string", () => {
    renderRunner();

    // Type an answer in EN.
    act(() => {
      fireEvent.change(getInput(), { target: { value: ANSWER } });
    });
    expect(getInput().value).toBe(ANSWER);
    assertUiInLang("en");

    // EN → SI: answer survives, UI strings flip.
    switchTo("si");
    expect(getInput().value).toBe(ANSWER);
    assertUiInLang("si");

    // SI → TA: still no data loss.
    switchTo("ta");
    expect(getInput().value).toBe(ANSWER);
    assertUiInLang("ta");

    // TA → EN: round-trip back to original language.
    switchTo("en");
    expect(getInput().value).toBe(ANSWER);
    assertUiInLang("en");

    // Sanity: the three localized question labels are genuinely different
    // (so the assertions above are not all matching the EN fallback).
    const labels = (["en", "si", "ta"] as const).map((l) =>
      pickText(SURVEY.questions[0].label, l),
    );
    expect(new Set(labels).size).toBe(3);
  });

  it("appending more text after each toggle accumulates correctly across languages", () => {
    renderRunner();

    act(() => {
      fireEvent.change(getInput(), { target: { value: "EN-part" } });
    });
    switchTo("si");
    expect(getInput().value).toBe("EN-part");

    act(() => {
      fireEvent.change(getInput(), { target: { value: "EN-part|SI-part" } });
    });
    switchTo("ta");
    expect(getInput().value).toBe("EN-part|SI-part");

    act(() => {
      fireEvent.change(getInput(), { target: { value: "EN-part|SI-part|TA-part" } });
    });
    switchTo("en");
    expect(getInput().value).toBe("EN-part|SI-part|TA-part");
  });
});
