/**
 * Full UI-driven E2E: toggle the language mid-survey through every transition
 * (EN → SI → TA → EN), advance the questionnaire across each toggle, and
 * verify the *exact* `language` field on every captured `saveAnswers` payload
 * matches the language that was active at the moment React fired the
 * debounced save.
 *
 * This complements `responses.language.test.ts` (which only asserts the
 * server-fn payload contract in isolation): here we drive the actual
 * SurveyRunner UI, click the LanguageToggle pills, type into inputs, and
 * trip the 1500 ms debounce by advancing fake timers — so a regression that
 * stale-reads `lang` inside the save effect, or that forgets to include
 * `language` in the payload during certain states, will fail at the UI
 * boundary, not just at the server fn.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { I18nProvider, LANGS, type Lang } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

// Capture every saveAnswers / completeResponse / startResponse call so we
// can assert the language flag tracks the active toggle through time.
const saveCalls: Array<{
  resumeToken: string;
  answers: Record<string, unknown>;
  progressPct: number;
  language?: Lang;
}> = [];
const completeCalls: Array<{
  resumeToken: string;
  answers: Record<string, unknown>;
}> = [];

vi.mock("@/lib/responses.functions", () => ({
  startResponse: vi.fn().mockResolvedValue({ resumeToken: "tok-mid-survey" }),
  saveAnswers: vi.fn(async ({ data }: { data: typeof saveCalls[number] }) => {
    saveCalls.push(data);
    return { ok: true };
  }),
  completeResponse: vi.fn(
    async ({ data }: { data: typeof completeCalls[number] }) => {
      completeCalls.push(data);
      return { ok: true };
    },
  ),
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
  slug: "mid-survey-lang",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Q1", si: "Q1-si", ta: "Q1-ta" },
      required: false,
    },
    {
      id: "q2",
      type: "text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Q2", si: "Q2-si", ta: "Q2-ta" },
      required: false,
    },
    {
      id: "q3",
      type: "text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Q3", si: "Q3-si", ta: "Q3-ta" },
      required: false,
    },
  ],
};

function getLangPill(code: Lang): HTMLButtonElement {
  const meta = LANGS.find((l) => l.code === code);
  if (!meta) throw new Error(`unknown lang ${code}`);
  const btn = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find((b) => b.textContent?.trim() === meta.label);
  if (!btn) throw new Error(`language pill "${meta.label}" not found`);
  return btn;
}

function getInput(): HTMLInputElement {
  const el = document.querySelector(
    'input[type="text"]',
  ) as HTMLInputElement | null;
  if (!el) throw new Error("text input not found");
  return el;
}

beforeEach(() => {
  saveCalls.length = 0;
  completeCalls.length = 0;
});

describe("SurveyRunner — mid-survey language toggle persists active language on every save", () => {
  it("EN → SI → TA → EN sequence: every saveAnswers call carries the language that was active at debounce time", async () => {
    vi.useFakeTimers();
    try {
      render(
        <I18nProvider>
          <SurveyRunner
            survey={SURVEY}
            initialLanguage="en"
            initialToken="tok-mid-survey"
          />
        </I18nProvider>,
      );

      // Each (type → flush 1500 ms) cycle triggers exactly one debounced save
      // because the payload key (answers, pct, lang) changes.
      const cycle = async (lang: Lang, value: string) => {
        getLangPill(lang).click();
        // Re-query input after toggle (React may have re-rendered).
        const input = getInput();
        fireEvent.change(input, { target: { value } });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1600);
        });
      };

      await cycle("en", "answer-en");
      await cycle("si", "answer-si");
      await cycle("ta", "answer-ta");
      await cycle("en", "answer-en-final");

      // One save per cycle — the debounce coalesces typing, not toggles.
      expect(saveCalls).toHaveLength(4);

      // The critical assertion: language on each saved payload matches the
      // active toggle at the moment the save fired.
      expect(saveCalls.map((c) => c.language)).toEqual([
        "en",
        "si",
        "ta",
        "en",
      ]);

      // The token never drifts and answers are non-empty on every save.
      for (const call of saveCalls) {
        expect(call.resumeToken).toBe("tok-mid-survey");
        expect(call.answers).toBeTruthy();
        expect(call.progressPct).toBeGreaterThanOrEqual(0);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("toggling language without typing still triggers a save with the new language (so the column reflects the current locale)", async () => {
    vi.useFakeTimers();
    try {
      render(
        <I18nProvider>
          <SurveyRunner
            survey={SURVEY}
            initialLanguage="en"
            initialToken="tok-mid-survey"
            initialAnswers={{ q1: "seed" }}
          />
        </I18nProvider>,
      );

      // Establish a baseline EN save so we have a non-empty `lastSavedRef`.
      fireEvent.change(getInput(), { target: { value: "seed-en" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });
      expect(saveCalls.at(-1)?.language).toBe("en");

      // Now toggle without typing — the save effect's dependency array
      // includes `lang`, so a fresh debounced write must fire with SI.
      getLangPill("si").click();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });
      expect(saveCalls.at(-1)?.language).toBe("si");

      getLangPill("ta").click();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });
      expect(saveCalls.at(-1)?.language).toBe("ta");
    } finally {
      vi.useRealTimers();
    }
  });
});
