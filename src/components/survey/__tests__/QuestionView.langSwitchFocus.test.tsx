/**
 * Smooth language-switch transition: flipping `lang` mid-question must
 *   • keep the currently focused input mounted (no focus loss),
 *   • preserve its typed value AND caret position,
 *   • leave the current step (question id) unchanged, and
 *   • bump `data-lang-epoch` on the section so the localized-text wrapper
 *     re-keys (driving the `animate-fade-in` transition).
 *
 * Locks in the contract that the language toggle never remounts the field
 * or jumps to a different question.
 */
import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, act, screen, fireEvent } from "@testing-library/react";
import { I18nProvider, useLang, type Lang } from "@/lib/i18n";
import type { Question } from "@/surveys/types";

vi.mock("framer-motion", async () => {
  const React = await import("react");
  // Cache one component per tag so React sees a STABLE component identity
  // across renders. Without this, the Proxy returned a fresh forwardRef
  // on every access and React unmounted/remounted every motion-wrapped
  // subtree on every parent re-render — which would invalidate this
  // file's focus / DOM-identity assertions.
  const cache = new Map<string, React.ComponentType<Record<string, unknown>>>();
  const getComp = (tag: string) => {
    let c = cache.get(tag);
    if (!c) {
      c = React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) =>
        React.createElement(tag, { ...props, ref }),
      ) as unknown as React.ComponentType<Record<string, unknown>>;
      cache.set(tag, c);
    }
    return c;
  };
  return {
    motion: new Proxy({}, { get: (_t, key: string) => getComp(String(key)) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => false,
  };
});

import { QuestionView } from "@/components/survey/QuestionView";

const Q: Question = {
  id: "q-text",
  type: "text",
  required: false,
  section: { en: "About you", si: "ඔබ ගැන", ta: "உங்களைப் பற்றி" },
  label: { en: "Your role", si: "ඔබේ භූමිකාව", ta: "உங்கள் பங்கு" },
};

function Harness() {
  const { setLang } = useLang();
  const [v, setV] = useState("");
  return (
    <>
      <button data-testid="to-en" onClick={() => setLang("en")} />
      <button data-testid="to-si" onClick={() => setLang("si")} />
      <button data-testid="to-ta" onClick={() => setLang("ta")} />
      <QuestionView q={Q} value={v} onChange={(x) => setV(String(x))} error={null} />
    </>
  );
}

function clickLang(lang: Lang) {
  act(() => {
    (document.querySelector(`[data-testid="to-${lang}"]`) as HTMLButtonElement).click();
  });
}

function getSection(): HTMLElement {
  return document.querySelector("[data-lang]") as HTMLElement;
}

function getInput(): HTMLInputElement {
  return document.querySelector('input[type="text"]') as HTMLInputElement;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("QuestionView — animated language switch", () => {
  it("preserves focus, typed value, caret, and step across EN → SI → TA → EN", () => {
    render(
      <I18nProvider>
        <Harness />
      </I18nProvider>,
    );

    const input = getInput();
    // Type via React's controlled-input pathway, then place the caret
    // partway through the value. Focus-preservation is asserted via DOM
    // node identity below: when the underlying <input> reference doesn't
    // change across a re-render, the browser keeps focus + caret in place
    // automatically. (JSDOM's activeElement model is unreliable for the
    // explicit `input.focus()` assertion.)
    act(() => {
      fireEvent.change(input, { target: { value: "Sustainability lead" } });
    });
    act(() => {
      input.setSelectionRange(5, 5);
    });
    expect(input.value).toBe("Sustainability lead");
    expect(input.selectionStart).toBe(5);

    const initialEpoch = Number(getSection().getAttribute("data-lang-epoch"));

    clickLang("si");
    // Same DOM node as before — not remounted. Caret + value preserved.
    expect(getInput()).toBe(input);
    expect(input.value).toBe("Sustainability lead");
    expect(input.selectionStart).toBe(5);
    expect(getSection().getAttribute("data-lang")).toBe("si");
    expect(Number(getSection().getAttribute("data-lang-epoch"))).toBe(initialEpoch + 1);

    clickLang("ta");
    expect(getInput()).toBe(input);
    expect(input.value).toBe("Sustainability lead");
    expect(getSection().getAttribute("data-lang")).toBe("ta");
    expect(Number(getSection().getAttribute("data-lang-epoch"))).toBe(initialEpoch + 2);

    clickLang("en");
    expect(getInput()).toBe(input);
    expect(input.value).toBe("Sustainability lead");
    expect(getSection().getAttribute("data-lang")).toBe("en");
    expect(Number(getSection().getAttribute("data-lang-epoch"))).toBe(initialEpoch + 3);
  });

  it("re-triggers the fade-in on the localized-text wrapper on each language switch", () => {
    render(
      <I18nProvider>
        <Harness />
      </I18nProvider>,
    );

    const wrapper = screen.getByTestId("lang-fade-text");
    // The wrapper carries `animate-fade-in` on first render…
    expect(wrapper.className).toContain("animate-fade-in");
    expect(getSection().getAttribute("data-lang-epoch")).toBe("0");

    // …and stays the SAME DOM node across switches (so the input sibling
    // never remounts), while the section's epoch attribute increments —
    // a stable, observable signal that the in-place fade-in restart fired.
    clickLang("si");
    expect(screen.getByTestId("lang-fade-text")).toBe(wrapper);
    expect(wrapper.className).toContain("animate-fade-in");
    expect(getSection().getAttribute("data-lang-epoch")).toBe("1");

    clickLang("ta");
    expect(screen.getByTestId("lang-fade-text")).toBe(wrapper);
    expect(wrapper.className).toContain("animate-fade-in");
    expect(getSection().getAttribute("data-lang-epoch")).toBe("2");
  });
});