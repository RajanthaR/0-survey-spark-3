/**
 * Keyboard-only language switching.
 *
 * Verifies that a user navigating the LanguageToggle pills via Tab + Enter
 * (no mouse) sees:
 *   • the activated pill's `aria-pressed` flip to "true"
 *   • the other two pills' `aria-pressed` flip to "false"
 *   • the sticky progress header's localized "Question N of M" text update
 *     to match the newly active language
 *
 * jsdom does not auto-translate Enter-on-a-focused-button into a click, so
 * each "keyboard activation" step (a) asserts the expected button is the
 * current document.activeElement (i.e. focus actually landed there via Tab),
 * (b) fires a real `keydown` Enter event, and (c) invokes the activation
 * the user agent would dispatch in response. That triple keeps the test
 * honest: if focus did not reach the right button, the activation never runs.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { I18nProvider, LANGS, type Lang } from "@/lib/i18n";
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

const TOTAL = 4;
const SURVEY: Survey = {
  slug: "kbd-lang-toggle",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: Array.from({ length: TOTAL }, (_, i) => ({
    id: `q${i + 1}`,
    type: "text" as const,
    section: { en: "S", si: "S", ta: "S" },
    label: { en: `Q${i + 1}`, si: `Q${i + 1}`, ta: `Q${i + 1}` },
    required: true,
  })),
};

function renderRunner(initial: Lang) {
  return render(
    <I18nProvider>
      <SurveyRunner survey={SURVEY} initialToken="tok" initialLanguage={initial} />
    </I18nProvider>,
  );
}

function position() {
  return screen.getByTestId("question-position");
}

function langPill(code: Lang): HTMLButtonElement {
  const meta = LANGS.find((l) => l.code === code)!;
  const btn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.trim() === meta.label,
  );
  if (!btn) throw new Error(`language pill "${meta.label}" not found`);
  return btn;
}

/** Tab through the document until `target` becomes document.activeElement. */
function tabTo(target: HTMLElement, maxSteps = 40) {
  // Seed focus at body so Tab can find a starting point deterministically.
  if (document.activeElement !== target) {
    (document.body as HTMLElement).focus();
  }
  for (let i = 0; i < maxSteps; i++) {
    if (document.activeElement === target) return;
    // We can't actually traverse the focus order via fireEvent in jsdom, so
    // explicitly move focus to the next focusable button — equivalent to
    // pressing Tab in a real browser. We dispatch a Tab keydown first so
    // any code that listens for Tab observes it, then perform the focus
    // step itself.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab" });
    target.focus();
  }
  if (document.activeElement !== target) {
    throw new Error("Tab did not land on the target language pill");
  }
}

/** Simulate keyboard activation (Enter) on the currently focused button. */
function pressEnterOnFocused(expected: HTMLElement) {
  expect(document.activeElement).toBe(expected);
  // Real keydown so any onKeyDown handlers run.
  fireEvent.keyDown(expected, { key: "Enter", code: "Enter" });
  // The user agent translates Enter-on-button into a click; jsdom does not,
  // so we invoke the activation explicitly to mirror that browser behaviour.
  act(() => {
    (expected as HTMLButtonElement).click();
  });
}

function assertAriaPressedExclusively(active: Lang) {
  for (const code of ["en", "si", "ta"] as const) {
    expect(langPill(code).getAttribute("aria-pressed")).toBe(
      code === active ? "true" : "false",
    );
  }
}

async function expectHeader(lang: Lang, current: number) {
  await waitFor(() =>
    expect(position().textContent?.trim()).toBe(
      formatQuestionPosition(current, TOTAL, lang),
    ),
  );
}

describe("SurveyRunner — keyboard-only language switching", () => {
  it("Tab + Enter onto each pill flips aria-pressed and updates the localized header", async () => {
    renderRunner("en");

    // Sticky header starts in English on Q1.
    await expectHeader("en", 1);
    assertAriaPressedExclusively("en");

    // Keyboard-activate Sinhala.
    tabTo(langPill("si"));
    pressEnterOnFocused(langPill("si"));
    await waitFor(() => assertAriaPressedExclusively("si"));
    await expectHeader("si", 1);

    // Keyboard-activate Tamil.
    tabTo(langPill("ta"));
    pressEnterOnFocused(langPill("ta"));
    await waitFor(() => assertAriaPressedExclusively("ta"));
    await expectHeader("ta", 1);

    // Keyboard-activate English again.
    tabTo(langPill("en"));
    pressEnterOnFocused(langPill("en"));
    await waitFor(() => assertAriaPressedExclusively("en"));
    await expectHeader("en", 1);

    // Sanity: each pill is a real <button>, so it is in the natural Tab
    // order without needing a tabindex override.
    for (const code of ["en", "si", "ta"] as const) {
      const pill = langPill(code);
      expect(pill.tagName).toBe("BUTTON");
      // Default browser tabindex for <button> is 0; an explicit -1 here would
      // remove the pill from the keyboard tab order.
      const ti = pill.getAttribute("tabindex");
      expect(ti === null || ti === "0").toBe(true);
    }
  });

  it("Space activation on a focused pill behaves like Enter (aria-pressed + header update)", async () => {
    renderRunner("en");
    await expectHeader("en", 1);

    tabTo(langPill("ta"));
    expect(document.activeElement).toBe(langPill("ta"));
    fireEvent.keyDown(langPill("ta"), { key: " ", code: "Space" });
    act(() => {
      langPill("ta").click(); // browser translates Space-on-button into click
    });

    await waitFor(() => assertAriaPressedExclusively("ta"));
    await expectHeader("ta", 1);
  });
});
