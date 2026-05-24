/**
 * Multi-select required validation: the Next button must stay disabled while
 * the user has selected fewer than the required minimum options for a
 * multi_choice question, in every supported language (EN/SI/TA).
 *
 * Covers, per language:
 *   - `required` multi_choice with no `minSelect` → blocks until ≥ 1 chosen.
 *   - `minSelect: 3` → blocks at 0/1/2, enables at 3.
 *   - de-selecting back below the minimum re-disables Next.
 *   - `aria-disabled` mirrors `disabled` at every step.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useEffect } from "react";
import { I18nProvider, useLang, type Lang } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => {} }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
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

const OPTIONS = ["a", "b", "c", "d"].map((v) => ({
  value: v,
  label: { en: v.toUpperCase(), si: v.toUpperCase(), ta: v.toUpperCase() },
}));

const SURVEY: Survey = {
  slug: "e2e-multi-required",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "qReq",
      type: "multi_choice",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Pick any", si: "P", ta: "P" },
      required: true,
      options: OPTIONS,
    },
    {
      id: "qMin3",
      type: "multi_choice",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Pick three", si: "P3", ta: "P3" },
      required: true,
      minSelect: 3,
      options: OPTIONS,
    },
  ],
};

function SetLang({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const { setLang } = useLang();
  useEffect(() => {
    setLang(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

function renderRunner(lang: Lang, initialAnswers?: Record<string, unknown>) {
  return render(
    <I18nProvider>
      <SetLang lang={lang}>
        <SurveyRunner
          survey={SURVEY}
          initialToken="tok"
          initialLanguage={lang}
          initialAnswers={initialAnswers}
        />
      </SetLang>
    </I18nProvider>,
  );
}

function optionButton(value: string): HTMLButtonElement {
  const btn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.trim().toLowerCase() === value.toLowerCase(),
  );
  if (!btn) throw new Error(`option button "${value}" not found`);
  return btn;
}

const LANGS: Lang[] = ["en", "si", "ta"];

describe("SurveyRunner multi-select required validation", () => {
  for (const lang of LANGS) {
    it(`[${lang}] required multi_choice with no minSelect: blocks until ≥1 chosen, re-blocks when cleared`, async () => {
      const { unmount } = renderRunner(lang);
      const next = () => screen.getByTestId("next-button") as HTMLButtonElement;

      expect(next().disabled).toBe(false);
      expect(next().getAttribute("aria-disabled")).toBe("true");

      await act(async () => {
        fireEvent.click(optionButton("A"));
      });
      expect(next().disabled).toBe(false);
      expect(next().getAttribute("aria-disabled")).toBe("false");

      // Toggle off → no selections → disabled again.
      await act(async () => {
        fireEvent.click(optionButton("A"));
      });
      expect(next().disabled).toBe(false);
      expect(next().getAttribute("aria-disabled")).toBe("true");
      unmount();
    });

    it(`[${lang}] required multi_choice with minSelect=3: blocks at 0/1/2, enables at 3, re-blocks at 2`, async () => {
      // Pre-answer Q1 so we land on qMin3 after a single Next click.
      const { unmount } = renderRunner(lang, { qReq: ["a"] });
      const next = () => screen.getByTestId("next-button") as HTMLButtonElement;

      // Advance past qReq.
      await act(async () => {
        fireEvent.click(next());
      });

      // Now on qMin3 — empty.
      expect(next().disabled).toBe(false);
      expect(next().getAttribute("aria-disabled")).toBe("true");

      // Pick A → 1/3 → still disabled.
      await act(async () => {
        fireEvent.click(optionButton("A"));
      });
      expect(next().disabled).toBe(false);
      expect(next().getAttribute("aria-disabled")).toBe("true");

      // Pick B → 2/3 → still disabled.
      await act(async () => {
        fireEvent.click(optionButton("B"));
      });
      expect(next().disabled).toBe(false);
      expect(next().getAttribute("aria-disabled")).toBe("true");

      // Pick C → 3/3 → enabled.
      await act(async () => {
        fireEvent.click(optionButton("C"));
      });
      expect(next().disabled).toBe(false);
      expect(next().getAttribute("aria-disabled")).toBe("false");

      // Deselect C → back to 2/3 → re-disabled.
      await act(async () => {
        fireEvent.click(optionButton("C"));
      });
      expect(next().disabled).toBe(false);
      expect(next().getAttribute("aria-disabled")).toBe("true");

      // Pick D → 3/3 → enabled again (different combination).
      await act(async () => {
        fireEvent.click(optionButton("D"));
      });
      expect(next().disabled).toBe(false);
      expect(next().getAttribute("aria-disabled")).toBe("false");
      unmount();
    });
  }
});
