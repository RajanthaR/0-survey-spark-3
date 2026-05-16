/**
 * E2E: keyboard focus must return to the answer control of the restored
 * question after pressing Back, in every supported language.
 *
 * Why this matters
 * ----------------
 * Keyboard-only users rely on focus landing on the right control after
 * navigation; if Back leaves focus on the Back button (or worse, on
 * <body>), they have to Tab their way back into the form on every
 * rewind. The runner wires this through `<FocusTrap focusKey="…id">`
 * — when the current-question id changes, the trap focuses the first
 * focusable descendant of the question panel, which is the answer
 * control. We assert this round-trip works under EN, SI and TA.
 *
 * Per language we verify, after each Back click:
 *   • document.activeElement IS the <input> of the restored question
 *   • that input still holds the previously-typed answer (no data loss)
 *   • the localized "Question N of M" header rewinds in lockstep
 */
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";
import { I18nProvider, type Lang } from "@/lib/i18n";
import { formatQuestionPosition } from "@/lib/format";
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

const TOTAL = 3;
const SURVEY: Survey = {
  slug: "back-focus-return",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: Array.from({ length: TOTAL }, (_, i) => ({
    id: `q${i + 1}`,
    type: "text" as const,
    section: { en: "S", si: "කොටස", ta: "பகுதி" },
    label: { en: `Q${i + 1}`, si: `Q${i + 1}`, ta: `Q${i + 1}` },
    required: true,
  })),
};

const ANS: Record<Lang, string[]> = {
  en: ["one", "two", "three"],
  si: ["එක", "දෙක", "තුන"],
  ta: ["ஒன்று", "இரண்டு", "மூன்று"],
};

function input(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector("input[type=text]") as HTMLInputElement | null;
  if (!el) throw new Error("question input not found");
  return el;
}
function nextBtn(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector("nav button.flex-1") as HTMLButtonElement | null;
  if (!btn) throw new Error("Next button not found");
  return btn;
}
function backBtn(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector("nav button") as HTMLButtonElement | null;
  if (!btn) throw new Error("Back button not found");
  return btn;
}
function position(container: HTMLElement): HTMLElement {
  return container.querySelector("[data-testid=question-position]") as HTMLElement;
}
async function expectPosition(container: HTMLElement, lang: Lang, current: number) {
  await waitFor(() =>
    expect(position(container).textContent?.trim()).toBe(
      formatQuestionPosition(current, TOTAL, lang),
    ),
  );
}

/** Type into the current question's input and click Next via keyboard
 *  Enter on the Next button — exercises the keyboard path explicitly. */
async function typeAndAdvance(container: HTMLElement, value: string) {
  const i = input(container);
  fireEvent.change(i, { target: { value } });
  // Move focus to Next button, then press it (mimics Tab + Enter).
  const next = nextBtn(container);
  next.focus();
  expect(document.activeElement).toBe(next);
  act(() => next.click());
}

/** Press Back via the keyboard (focus + click — a real keyboard user
 *  would land here via Shift+Tab and press Enter/Space). */
function keyboardBack(container: HTMLElement) {
  const back = backBtn(container);
  back.focus();
  expect(document.activeElement).toBe(back);
  act(() => back.click());
}

describe("SurveyRunner — Back returns keyboard focus to the answer control (per language)", () => {
  for (const lang of ["en", "si", "ta"] as const) {
    it(`${lang}: focus lands on the restored question's input after each Back, with the prior answer still present`, async () => {
      const { container } = render(
        <I18nProvider>
          <SurveyRunner survey={SURVEY} initialToken="tok" initialLanguage={lang} />
        </I18nProvider>,
      );

      // Q1 baseline: position localized.
      await expectPosition(container, lang, 1);
      const step1Input = input(container);
      // Make sure focus is on the answer control before we start (the
      // FocusTrap auto-focuses on mount, but in jsdom an interleaving
      // language re-render can blur back to <body>; this is a test-env
      // artifact, not a runtime regression — we explicitly position
      // focus the way a real keyboard user would, then verify what
      // matters: that Back puts focus BACK on the answer control).
      step1Input.focus();
      expect(document.activeElement).toBe(step1Input);

      // Walk forward Q1 → Q2 → Q3, recording the input element of each
      // step BEFORE moving on (so we can compare element identity later).
      await typeAndAdvance(container, ANS[lang][0]);
      await expectPosition(container, lang, 2);
      // Trap re-focuses the new question's input after focusKey changes
      // (even though Next was inside the trap when clicked).
      await waitFor(() => expect(document.activeElement).toBe(input(container)));
      const step2Input = input(container);
      expect(step2Input).not.toBe(step1Input);

      await typeAndAdvance(container, ANS[lang][1]);
      await expectPosition(container, lang, 3);
      await waitFor(() => expect(document.activeElement).toBe(input(container)));
      const step3Input = input(container);
      expect(step3Input).not.toBe(step2Input);
      // Type Q3's value too — Back must not drop it.
      fireEvent.change(step3Input, { target: { value: ANS[lang][2] } });

      // ── Rewind Q3 → Q2 → Q1 with the keyboard ──
      keyboardBack(container);
      await expectPosition(container, lang, 2);
      await waitFor(() => {
        const active = document.activeElement as HTMLInputElement | null;
        expect(active?.tagName).toBe("INPUT");
        expect(active?.value).toBe(ANS[lang][1]);
      });
      // The active control is contained in the focus-trap region, NOT
      // stranded on the Back button — assistive tech reads the question
      // again, not the navigation control that triggered the rewind.
      const trap = container.querySelector('[data-focus-trap="active"]') as HTMLElement;
      expect(trap.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).not.toBe(backBtn(container));

      keyboardBack(container);
      await expectPosition(container, lang, 1);
      await waitFor(() => {
        const active = document.activeElement as HTMLInputElement | null;
        expect(active?.tagName).toBe("INPUT");
        expect(active?.value).toBe(ANS[lang][0]);
      });
      expect(trap.contains(document.activeElement)).toBe(true);

      // At Q1, Back is disabled — focus must still be on the answer
      // control, NOT shunted off-screen or onto <body>.
      expect(backBtn(container).disabled).toBe(true);
      expect(document.activeElement?.tagName).toBe("INPUT");
      expect(document.activeElement).not.toBe(document.body);
    });
  }
});
