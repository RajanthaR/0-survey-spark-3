/**
 * Verifies the required-answer Next-button guard remains correct after the
 * user navigates Back to a previous question and returns. The guard must
 * react to the *current* question's answer state, in every supported
 * language (EN/SI/TA).
 *
 * Flow per language:
 *   Q1 (text, required) → fill "Sample Org" → Next enabled → click Next
 *   Q2 (email, required, empty) → Next disabled
 *   click Back → Q1 → Next still enabled (Q1 answer preserved)
 *   click Next → Q2 → Next still disabled (Q2 still empty)
 *   type valid email → Next enabled
 *   click Back → Q1 → Next enabled
 *   click Next → Q2 → Next still enabled (Q2 answer preserved across Back)
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useEffect } from "react";
import { I18nProvider, useLang, UI, pickText, type Lang } from "@/lib/i18n";
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

const SURVEY: Survey = {
  slug: "e2e-next-back",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Name", si: "නම", ta: "பெயர்" },
      required: true,
    },
    {
      id: "q2",
      type: "email",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Email", si: "ඊමේල්", ta: "மின்னஞ்சல்" },
      required: true,
    },
  ],
};

function SetLang({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const { setLang } = useLang();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLang(lang); }, []);
  return <>{children}</>;
}

function renderRunner(lang: Lang) {
  return render(
    <I18nProvider>
      <SetLang lang={lang}>
        <SurveyRunner survey={SURVEY} initialToken="tok" initialLanguage={lang} />
      </SetLang>
    </I18nProvider>,
  );
}

function getBackButton(lang: Lang): HTMLButtonElement {
  const label = pickText(UI.back, lang);
  // The "back" aria-label is also used by the Review-edit button, but on the
  // questions stage only the bottom-nav Back button is mounted.
  const btn = Array.from(document.querySelectorAll("button")).find(
    (b) => b.getAttribute("aria-label") === label,
  );
  if (!btn) throw new Error(`Back button not found for lang=${lang}`);
  return btn as HTMLButtonElement;
}

const LANGS: Lang[] = ["en", "si", "ta"];

describe("SurveyRunner Next guard after Back", () => {
  for (const lang of LANGS) {
    it(`[${lang}] re-evaluates the Next-button guard for the current question after Back`, async () => {
      renderRunner(lang);
      const next = () => screen.getByTestId("next-button") as HTMLButtonElement;

      // Q1: fill, advance.
      const q1 = screen.getByRole("textbox") as HTMLInputElement;
      await act(async () => {
        fireEvent.change(q1, { target: { value: "Sample Org" } });
      });
      expect(next().disabled).toBe(false);
      await act(async () => { fireEvent.click(next()); });

      // Q2: empty required → disabled.
      const q2Initial = screen.getByRole("textbox") as HTMLInputElement;
      expect(q2Initial.type).toBe("email");
      expect(next().disabled).toBe(true);
      expect(next().getAttribute("aria-disabled")).toBe("true");

      // Back → Q1, guard must reflect Q1 (still answered) → enabled.
      await act(async () => { fireEvent.click(getBackButton(lang)); });
      const q1AgainText = screen.getByRole("textbox") as HTMLInputElement;
      expect(q1AgainText.type).toBe("text");
      expect(q1AgainText.value).toBe("Sample Org");
      expect(next().disabled).toBe(false);
      expect(next().getAttribute("aria-disabled")).toBe("false");

      // Forward to Q2 again, still empty → disabled (guard switched back).
      await act(async () => { fireEvent.click(next()); });
      const q2Again = screen.getByRole("textbox") as HTMLInputElement;
      expect(q2Again.type).toBe("email");
      expect(q2Again.value).toBe("");
      expect(next().disabled).toBe(true);
      expect(next().getAttribute("aria-disabled")).toBe("true");

      // Type a valid email → enabled.
      await act(async () => {
        fireEvent.change(q2Again, { target: { value: "user@example.com" } });
      });
      expect(next().disabled).toBe(false);
      expect(next().getAttribute("aria-disabled")).toBe("false");

      // Back → Q1, guard reflects Q1 (still answered) → enabled.
      await act(async () => { fireEvent.click(getBackButton(lang)); });
      expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Sample Org");
      expect(next().disabled).toBe(false);

      // Forward to Q2: previously-typed email is preserved → still enabled.
      await act(async () => { fireEvent.click(next()); });
      const q2Final = screen.getByRole("textbox") as HTMLInputElement;
      expect(q2Final.type).toBe("email");
      expect(q2Final.value).toBe("user@example.com");
      expect(next().disabled).toBe(false);
      expect(next().getAttribute("aria-disabled")).toBe("false");
    });
  }
});
