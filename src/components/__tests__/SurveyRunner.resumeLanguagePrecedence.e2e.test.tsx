import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { I18nProvider, LANGS, type Lang } from "@/lib/i18n";
import { formatQuestionPosition } from "@/lib/format";
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
  slug: "resume-language-precedence",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Q1", si: "Q1", ta: "Q1" },
      required: false,
    },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "en";
});

function seedTouchedLang(lang: Lang) {
  window.localStorage.setItem("eip.lang", lang);
  window.localStorage.setItem("eip.lang.touched", "1");
}

function renderRunner(initialLanguage: Lang, forceInitialLanguage = false) {
  return render(
    <I18nProvider>
      <SurveyRunner
        survey={SURVEY}
        initialToken="tok"
        initialLanguage={initialLanguage}
        forceInitialLanguage={forceInitialLanguage}
      />
    </I18nProvider>,
  );
}

function langPill(code: Lang): HTMLButtonElement {
  const meta = LANGS.find((l) => l.code === code);
  if (!meta) throw new Error(`unknown lang ${code}`);
  const btn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.trim() === meta.label,
  );
  if (!btn) throw new Error(`language pill "${meta.label}" not found`);
  return btn;
}

async function expectActiveLanguage(lang: Lang) {
  await waitFor(() =>
    expect(screen.getByTestId("question-position").textContent?.trim()).toBe(
      formatQuestionPosition(1, 1, lang),
    ),
  );
  expect(langPill(lang).getAttribute("aria-pressed")).toBe("true");
}

describe("SurveyRunner resume language precedence", () => {
  it("preserves a touched browser language for ordinary server-language adoption", async () => {
    seedTouchedLang("en");

    renderRunner("si");

    await expectActiveLanguage("en");
    expect(window.localStorage.getItem("eip.lang")).toBe("en");
    expect(window.localStorage.getItem("eip.lang.touched")).toBe("1");
  });

  it("lets direct resume language override a touched browser language", async () => {
    seedTouchedLang("en");

    renderRunner("si", true);

    await expectActiveLanguage("si");
    expect(window.localStorage.getItem("eip.lang")).toBe("si");
    expect(window.localStorage.getItem("eip.lang.touched")).toBe("1");
    expect(document.documentElement.lang).toBe("si");
  });
});
