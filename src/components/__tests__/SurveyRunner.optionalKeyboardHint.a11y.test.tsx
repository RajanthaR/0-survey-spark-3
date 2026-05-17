/**
 * Verifies the keyboard-only hint above the optional consent cards renders
 * the correct localized string in EN/SI/TA, stays visible only on the wider
 * (sm+) breakpoint via Tailwind utility classes (so it's effectively
 * keyboard/desktop-targeted), and remains semantically associated with the
 * optional consent group for screen readers — i.e. it appears in the same
 * accessibility subtree as the `role="group"` ul, before any of the
 * `role="switch"` cards, so AT users hear the keyboard help before reaching
 * the cards.
 */
import { describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { I18nProvider, UI, pickText } from "@/lib/i18n";
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
  slug: "kbd-hint",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [
    { id: "o1", required: false, label: { en: "Opt one", si: "අ1", ta: "த1" } },
    { id: "o2", required: false, label: { en: "Opt two", si: "අ2", ta: "த2" } },
  ],
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

function clickMainCta(container: HTMLElement) {
  const btn = container.querySelector("main button.h-14") as HTMLButtonElement;
  if (!btn) throw new Error("No main CTA");
  act(() => {
    btn.click();
  });
}

function renderAtOptional(lang: "en" | "si" | "ta") {
  const utils = render(
    <I18nProvider>
      <SurveyRunner survey={SURVEY} initialLanguage={lang} />
    </I18nProvider>,
  );
  // intro → consent (empty required) → consent-optional
  clickMainCta(utils.container);
  clickMainCta(utils.container);
  return utils;
}

function getHint(): HTMLElement {
  const el = document.querySelector('[data-testid="optional-keyboard-hint"]') as HTMLElement | null;
  if (!el) throw new Error("Keyboard hint not rendered");
  return el;
}

function getOptionalGroup(): HTMLElement {
  const el = document.querySelector('ul[role="group"]') as HTMLElement | null;
  if (!el) throw new Error("Optional consent group not rendered");
  return el;
}

describe("Optional consent — keyboard hint a11y", () => {
  it.each(["en", "si", "ta"] as const)(
    "renders the localized keyboard hint in %s with non-empty text matching the dictionary",
    (lang) => {
      renderAtOptional(lang);
      const hint = getHint();
      const expected = pickText(UI.optionalKeyboardHint, lang);
      expect(expected.length).toBeGreaterThan(0);
      expect(hint.textContent?.trim()).toBe(expected);
    },
  );

  it("Sinhala hint contains Sinhala-script characters (U+0D80–U+0DFF)", () => {
    renderAtOptional("si");
    const text = getHint().textContent ?? "";
    expect(/[\u0D80-\u0DFF]/.test(text)).toBe(true);
    // Sanity: should not be the English copy.
    expect(text).not.toContain("Keyboard:");
  });

  it("Tamil hint contains Tamil-script characters (U+0B80–U+0BFF)", () => {
    renderAtOptional("ta");
    const text = getHint().textContent ?? "";
    expect(/[\u0B80-\u0BFF]/.test(text)).toBe(true);
    expect(text).not.toContain("Keyboard:");
  });

  it("hint is hidden on small viewports and shown on sm+ via responsive utility classes", () => {
    renderAtOptional("en");
    const hint = getHint();
    // Tailwind: `hidden sm:block` — base hidden, revealed at sm breakpoint.
    expect(hint.classList.contains("hidden")).toBe(true);
    expect(hint.classList.contains("sm:block")).toBe(true);
  });

  it("is NOT aria-hidden so screen readers still announce it", () => {
    renderAtOptional("en");
    const hint = getHint();
    // The Tailwind `hidden` class controls visual layout, not ARIA. The hint
    // must NOT carry aria-hidden — keyboard/AT users must hear the help.
    expect(hint.hasAttribute("aria-hidden")).toBe(false);
    let node: HTMLElement | null = hint;
    while (node) {
      expect(node.getAttribute("aria-hidden")).not.toBe("true");
      node = node.parentElement;
    }
  });

  it("appears in DOM order BEFORE the optional consent group, so AT reaches it first", () => {
    renderAtOptional("en");
    const hint = getHint();
    const group = getOptionalGroup();
    // DOCUMENT_POSITION_FOLLOWING (4): group follows hint.
    const pos = hint.compareDocumentPosition(group);
    expect(pos & 4).toBe(4);
    // Both share the same accessible region (the consent-optional <section>).
    const section = hint.closest("section");
    expect(section).not.toBeNull();
    expect(section!.contains(group)).toBe(true);
  });

  it("appears BEFORE every role=switch card so the help is announced before the controls", () => {
    renderAtOptional("en");
    const hint = getHint();
    const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('button[role="switch"]'));
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(hint.compareDocumentPosition(card) & 4).toBe(4);
    }
  });

  it("the optional group's accessible name is the localized 'Optional permissions' label, in each language", () => {
    for (const lang of ["en", "si", "ta"] as const) {
      const { unmount } = renderAtOptional(lang);
      const group = getOptionalGroup();
      expect(group.getAttribute("aria-label")).toBe(pickText(UI.optionalTitle, lang));
      unmount();
    }
  });
});
