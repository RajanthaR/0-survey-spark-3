import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { I18nProvider, useLang, type Lang } from "@/lib/i18n";
import { useEffect } from "react";
import type { Survey } from "@/surveys/types";

// ── Mocks ─────────────────────────────────────────────────────────
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
  toast: Object.assign(() => {}, {
    success: () => {},
    error: () => {},
  }),
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

// ── Fixture ──────────────────────────────────────────────────────
const SURVEY: Survey = {
  slug: "e2e-progress",
  title: { en: "E2E", si: "අත්හදා බැලීම", ta: "சோதனை" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: Array.from({ length: 4 }, (_, i) => ({
    id: `q${i + 1}`,
    type: "text" as const,
    section: { en: "S", si: "S", ta: "S" },
    label: { en: `Q${i + 1}`, si: `Q${i + 1}`, ta: `Q${i + 1}` },
    required: true,
  })),
};

function SetLang({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const { setLang } = useLang();
  // Mount-only seed; we deliberately do NOT track setLang in deps so a later
  // user-driven toggle (LanguageToggle click) is not reverted by this effect.
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

function progressText() {
  return screen.getByTestId("question-position").textContent ?? "";
}

function advance(container: HTMLElement, value: string) {
  const input = container.querySelector("input[type=text]") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  const nextBtn = container.querySelector("nav button.flex-1") as HTMLButtonElement;
  act(() => { nextBtn.click(); });
}

function goBack(container: HTMLElement) {
  // Bottom nav layout: [Back, Save&Exit, Next]. Back is the first button
  // in the nav and is the only one with no text label (icon only).
  const navButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement>("nav button"),
  );
  const backBtn = navButtons[0];
  if (!backBtn) throw new Error("Back button not found");
  act(() => { backBtn.click(); });
}

async function expectProgress(text: string) {
  await waitFor(() => expect(progressText()).toBe(text));
}

// ── Tests ────────────────────────────────────────────────────────
describe("SurveyRunner progress header — localized announcements", () => {
  it("English: announces 'Question N of 4' and updates as user advances", async () => {
    const { container } = renderRunner("en");
    const node = screen.getByTestId("question-position");
    expect(node.getAttribute("aria-live")).toBe("polite");
    expect(node.getAttribute("role")).toBe("status");
    await expectProgress("Question 1 of 4");
    advance(container, "a");
    await expectProgress("Question 2 of 4");
    advance(container, "b");
    await expectProgress("Question 3 of 4");
    advance(container, "c");
    await expectProgress("Question 4 of 4");
  });

  it("Sinhala: noun-first 'ප්‍රශ්න N / 4' across multiple steps", async () => {
    const { container } = renderRunner("si");
    await expectProgress("ප්‍රශ්න 1 / 4");
    advance(container, "අ");
    await expectProgress("ප්‍රශ්න 2 / 4");
    advance(container, "ආ");
    await expectProgress("ප්‍රශ්න 3 / 4");
    // Guard against the legacy "N ප්‍රශ්නය" ordering.
    expect(progressText().startsWith("ප්‍රශ්න")).toBe(true);
    expect(progressText()).not.toMatch(/ප්‍රශ්නය/);
  });

  it("Tamil: noun-first 'கேள்விகள் N / 4' across multiple steps", async () => {
    const { container } = renderRunner("ta");
    await expectProgress("கேள்விகள் 1 / 4");
    advance(container, "அ");
    await expectProgress("கேள்விகள் 2 / 4");
    advance(container, "ஆ");
    await expectProgress("கேள்விகள் 3 / 4");
    expect(progressText().startsWith("கேள்விகள்")).toBe(true);
  });

  it("relocalizes the progress header immediately when language is toggled mid-survey", async () => {
    const { container } = renderRunner("en");
    await expectProgress("Question 1 of 4");
    advance(container, "a");
    await expectProgress("Question 2 of 4");

    // Locate the language toggle buttons via their visible labels. The
    // active button wraps a motion.span overlay; only inactive buttons are
    // useful click targets.
    const langButton = (label: string) => {
      const btns = Array.from(container.querySelectorAll("button"));
      const found = btns.find((b) => b.textContent?.trim() === label);
      if (!found) throw new Error(`Language button "${label}" not found`);
      return found as HTMLButtonElement;
    };

    act(() => { fireEvent.click(langButton("සි")); });
    await waitFor(() =>
      expect(langButton("සි").getAttribute("aria-pressed")).toBe("true"),
    );
    await expectProgress("ප්‍රශ්න 2 / 4");

    act(() => { fireEvent.click(langButton("த")); });
    await waitFor(() =>
      expect(langButton("த").getAttribute("aria-pressed")).toBe("true"),
    );
    await expectProgress("கேள்விகள் 2 / 4");

    // Advancing after a switch keeps the new locale.
    advance(container, "ஆ");
    await expectProgress("கேள்விகள் 3 / 4");

    act(() => { fireEvent.click(langButton("EN")); });
    await expectProgress("Question 3 of 4");
  });

  describe("Back button updates the localized progress header", () => {
    const cases: Array<{
      lang: Lang;
      input: string;
      texts: [string, string, string];
    }> = [
      { lang: "en", input: "x", texts: ["Question 1 of 4", "Question 2 of 4", "Question 3 of 4"] },
      { lang: "si", input: "අ", texts: ["ප්‍රශ්න 1 / 4", "ප්‍රශ්න 2 / 4", "ප්‍රශ්න 3 / 4"] },
      { lang: "ta", input: "அ", texts: ["கேள்விகள் 1 / 4", "கேள்விகள் 2 / 4", "கேள்விகள் 3 / 4"] },
    ];

    for (const { lang, input, texts } of cases) {
      it(`${lang}: Back navigates to the previous question and re-renders the header`, async () => {
        const { container } = renderRunner(lang);
        const [t1, t2, t3] = texts;
        await expectProgress(t1);

        // Back is disabled on the first question.
        const backBtn = container.querySelector("nav button") as HTMLButtonElement;
        expect(backBtn.disabled).toBe(true);

        advance(container, input);
        await expectProgress(t2);
        advance(container, input + input);
        await expectProgress(t3);

        goBack(container);
        await expectProgress(t2);

        goBack(container);
        await expectProgress(t1);

        // Back button should now be disabled again at question 1.
        await waitFor(() => {
          const b = container.querySelector("nav button") as HTMLButtonElement;
          expect(b.disabled).toBe(true);
        });
      });
    }
  });

  describe("Required-answer guard — Next is blocked and progress does not advance", () => {
    const cases: Array<{ lang: Lang; first: string; second: string }> = [
      { lang: "en", first: "Question 1 of 4", second: "Question 2 of 4" },
      { lang: "si", first: "ප්‍රශ්න 1 / 4", second: "ප්‍රශ්න 2 / 4" },
      { lang: "ta", first: "கேள்விகள் 1 / 4", second: "கேள்விகள் 2 / 4" },
    ];

    for (const { lang, first, second } of cases) {
      it(`${lang}: clicking Next without an answer keeps the header on Q1`, async () => {
        const { container } = renderRunner(lang);
        await expectProgress(first);

        const nextBtn = container.querySelector(
          "nav button.flex-1",
        ) as HTMLButtonElement;
        expect(nextBtn).toBeTruthy();

        // Click Next 3 times with no input — guard must keep us on Q1.
        for (let i = 0; i < 3; i++) {
          act(() => { nextBtn.click(); });
        }
        // Give any pending state updates a chance to flush, then assert that
        // the localized header is still Q1.
        await new Promise((r) => setTimeout(r, 30));
        expect(progressText()).toBe(first);

        // Provide a valid answer; Next should now succeed and advance.
        const input = container.querySelector("input[type=text]") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "ok" } });
        act(() => { nextBtn.click(); });
        await expectProgress(second);
      });
    }
  });
});
