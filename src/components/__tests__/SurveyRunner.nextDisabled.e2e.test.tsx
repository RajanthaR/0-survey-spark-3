/**
 * Verifies that the Next button is disabled until the user provides a valid
 * required answer, and that the disabled state behaves identically across
 * English, Sinhala, and Tamil.
 *
 * Covers, per language:
 *  - required text question: disabled when empty, enabled after typing.
 *  - required email question with invalid format: blocked.
 *  - required email question with valid format: enabled.
 *  - aria-disabled mirrors the blocked state (a11y signal).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useEffect } from "react";
import { I18nProvider, useLang, type Lang } from "@/lib/i18n";
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
  slug: "e2e-next-disabled",
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

const LANGS: Lang[] = ["en", "si", "ta"];

async function advanceToQ2() {
  await act(async () => {
    fireEvent.click(screen.getByTestId("next-button"));
  });
}

describe("SurveyRunner Next button gating", () => {
  for (const lang of LANGS) {
    it(`[${lang}] disables Next until a required text answer is provided`, async () => {
      const { unmount } = renderRunner(lang);
      const next = screen.getByTestId("next-button") as HTMLButtonElement;

      expect(next.disabled).toBe(true);
      expect(next.getAttribute("aria-disabled")).toBe("true");

      const input = screen.getByRole("textbox") as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: "Sample Org" } });
      });
      expect(next.disabled).toBe(false);
      expect(next.getAttribute("aria-disabled")).toBe("false");
      unmount();
    });

    it(`[${lang}] keeps Next disabled when the required email is empty or malformed`, async () => {
      const { unmount } = renderRunner(lang, { q1: "Sample Org" });
      await advanceToQ2();

      const next = screen.getByTestId("next-button") as HTMLButtonElement;
      const email = screen.getByRole("textbox") as HTMLInputElement;
      expect(email.type).toBe("email");

      // empty required after a forward transition remains blocked while
      // staying focusable for the screen-reader announcement contract.
      expect(next.disabled).toBe(false);
      expect(next.getAttribute("aria-disabled")).toBe("true");
      expect(next.getAttribute("data-blocked")).toBe("true");

      // invalid format → still blocked
      await act(async () => {
        fireEvent.change(email, { target: { value: "not-an-email" } });
      });
      expect(next.disabled).toBe(false);
      expect(next.getAttribute("aria-disabled")).toBe("true");
      expect(next.getAttribute("data-blocked")).toBe("true");
      unmount();
    });

    it(`[${lang}] enables Next once a valid email is provided`, async () => {
      const { unmount } = renderRunner(lang, { q1: "Sample Org" });
      await advanceToQ2();

      const next = screen.getByTestId("next-button") as HTMLButtonElement;
      const email = screen.getByRole("textbox") as HTMLInputElement;

      await act(async () => {
        fireEvent.change(email, { target: { value: "user@example.com" } });
      });
      expect(next.disabled).toBe(false);
      expect(next.getAttribute("aria-disabled")).toBe("false");
      unmount();
    });
  }
});
