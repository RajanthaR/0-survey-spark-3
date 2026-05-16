/**
 * Focus-trap coverage for the survey step.
 *
 * The header contains a LanguageToggle that is focusable. While the user is
 * mid-survey (consent / consent-optional / questions), Tab and Shift+Tab must
 * cycle within the survey panel — keyboard users should never be able to land
 * on the language toggle (or any other background chrome) without explicit
 * intent. The intro / done stages are NOT trapped.
 */
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
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
  slug: "focus-trap",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [
    {
      id: "c13",
      required: true,
      shortLabel: { en: "Read sheet", si: "S", ta: "T" },
      label: { en: "I have read it.", si: "L", ta: "L" },
    },
    {
      id: "c2",
      required: true,
      shortLabel: { en: "Voluntary", si: "S", ta: "T" },
      label: { en: "Voluntary.", si: "L", ta: "L" },
    },
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
  act(() => { btn.click(); });
}

function getTrap() {
  return document.querySelector<HTMLElement>('[data-focus-trap="active"]');
}

function getLanguageToggleButtons(): HTMLButtonElement[] {
  // LanguageToggle lives in the <header>, outside the trap.
  const header = document.querySelector("header")!;
  return Array.from(header.querySelectorAll("button"));
}

function focusables(node: HTMLElement): HTMLElement[] {
  return Array.from(
    node.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function renderRunner(opts: { stage: "consent" | "questions" | "intro" }) {
  const utils = render(
    <I18nProvider>
      <SurveyRunner
        survey={SURVEY}
        initialLanguage="en"
        initialToken={opts.stage === "questions" ? "tok-x" : undefined}
      />
    </I18nProvider>,
  );
  if (opts.stage === "consent") clickMainCta(utils.container);
  return utils;
}

describe("SurveyRunner focus trap", () => {
  it("is INACTIVE on the intro stage (background nav remains tabbable)", () => {
    renderRunner({ stage: "intro" });
    const trap = document.querySelector('[data-focus-trap="inactive"]');
    expect(trap).not.toBeNull();
    expect(getTrap()).toBeNull();
  });

  it("activates around the consent panel and excludes the header LanguageToggle", () => {
    renderRunner({ stage: "consent" });
    const trap = getTrap();
    expect(trap).not.toBeNull();
    // Header (with LanguageToggle) is OUTSIDE the trap container.
    const header = document.querySelector("header")!;
    expect(trap!.contains(header)).toBe(false);
    // Language toggle buttons exist but are not inside the trap.
    const langButtons = getLanguageToggleButtons();
    expect(langButtons.length).toBeGreaterThan(0);
    for (const b of langButtons) {
      expect(trap!.contains(b)).toBe(false);
    }
  });

  it("auto-focuses the first focusable element inside the consent panel", async () => {
    renderRunner({ stage: "consent" });
    await waitFor(() => {
      const trap = getTrap()!;
      const first = focusables(trap)[0];
      expect(document.activeElement).toBe(first);
    });
  });

  it("Shift+Tab on the first focusable cycles to the last (does not escape into header)", () => {
    renderRunner({ stage: "consent" });
    const trap = getTrap()!;
    const els = focusables(trap);
    const first = els[0];
    const last = els[els.length - 1];
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(trap, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    // Critically: focus did NOT land on a header LanguageToggle button.
    for (const b of getLanguageToggleButtons()) {
      expect(document.activeElement).not.toBe(b);
    }
  });

  it("Tab on the last focusable cycles to the first (does not escape into header)", () => {
    renderRunner({ stage: "consent" });
    const trap = getTrap()!;
    const els = focusables(trap);
    const first = els[0];
    const last = els[els.length - 1];
    last.focus();
    fireEvent.keyDown(trap, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    for (const b of getLanguageToggleButtons()) {
      expect(document.activeElement).not.toBe(b);
    }
  });

  it("activates around the questions panel and includes the sticky bottom nav", async () => {
    renderRunner({ stage: "questions" });
    await waitFor(() => {
      const trap = getTrap();
      expect(trap).not.toBeNull();
      // Bottom nav (Back / Save / Next) lives inside the same trap.
      const nav = document.querySelector("nav");
      expect(nav).not.toBeNull();
      expect(trap!.contains(nav!)).toBe(true);
      // Header / LanguageToggle remain outside.
      for (const b of getLanguageToggleButtons()) {
        expect(trap!.contains(b)).toBe(false);
      }
    });
  });

  it("question stage Tab from the last nav button cycles back to the first focusable in the panel", async () => {
    renderRunner({ stage: "questions" });
    let trap!: HTMLElement;
    await waitFor(() => {
      trap = getTrap()!;
      expect(trap).not.toBeNull();
      expect(focusables(trap).length).toBeGreaterThan(1);
    });
    const els = focusables(trap);
    const first = els[0];
    const last = els[els.length - 1];
    last.focus();
    fireEvent.keyDown(trap, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });
});
