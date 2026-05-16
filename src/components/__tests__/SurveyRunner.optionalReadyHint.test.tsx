/**
 * Verifies the polite "You can continue now" hint on the optional consent
 * step is announced ONLY once the user has selected enough optional cards
 * (≥1). Before that, the live region must be empty so screen readers stay
 * silent until the threshold is met. Toggling the last selection back off
 * also clears the live region.
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
  slug: "ready-hint",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [
    { id: "o1", required: false, label: { en: "Opt one", si: "අ1", ta: "த1" } },
    { id: "o2", required: false, label: { en: "Opt two", si: "අ2", ta: "த2" } },
  ],
  questions: [
    { id: "q1", type: "text", section: { en: "S", si: "S", ta: "S" }, label: { en: "Q1", si: "Q1", ta: "Q1" }, required: false },
  ],
};

function clickMainCta(container: HTMLElement) {
  const btn = container.querySelector("main button.h-14") as HTMLButtonElement;
  if (!btn) throw new Error("No main CTA");
  act(() => { btn.click(); });
}

function renderAtOptional(lang: "en" | "si" | "ta" = "en") {
  const utils = render(
    <I18nProvider>
      <SurveyRunner survey={SURVEY} initialLanguage={lang} />
    </I18nProvider>,
  );
  clickMainCta(utils.container);
  clickMainCta(utils.container);
  return utils;
}

const getReady = () =>
  document.querySelector('[data-testid="optional-ready-hint"]') as HTMLElement;
const getIdle = () =>
  document.querySelector('[data-testid="optional-idle-hint"]') as HTMLElement | null;
const getCards = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button[role="switch"]'));

describe("Optional consent — polite ready-hint announcement threshold", () => {
  it("polite live region exists with role=status, aria-live=polite, aria-atomic=true", () => {
    renderAtOptional();
    const live = getReady();
    expect(live).not.toBeNull();
    expect(live.getAttribute("role")).toBe("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.getAttribute("aria-atomic")).toBe("true");
  });

  it("polite region is EMPTY on initial render (zero selections — below threshold)", () => {
    renderAtOptional();
    expect(getReady().textContent ?? "").toBe("");
    // The idle hint is shown as plain text (not in a live region).
    expect(getIdle()).not.toBeNull();
    expect(getIdle()!.hasAttribute("aria-live")).toBe(false);
  });

  it("populates the polite region with the localized ready text once ≥1 card is selected", () => {
    renderAtOptional("en");
    expect(getReady().textContent).toBe("");
    act(() => { getCards()[0].click(); });
    expect(getReady().textContent?.trim()).toBe(pickText(UI.optionalHintReady, "en"));
    // Idle hint disappears once threshold is crossed.
    expect(getIdle()).toBeNull();
  });

  it("clears the polite region when the user deselects back below the threshold", () => {
    renderAtOptional("en");
    act(() => { getCards()[0].click(); });
    expect(getReady().textContent?.trim().length).toBeGreaterThan(0);
    // Re-query: React re-rendered the panel, the previous ref may be stale.
    act(() => { getCards()[0].click(); });
    expect(getReady().textContent ?? "").toBe("");
    // Idle hint reappears.
    expect(getIdle()).not.toBeNull();
  });

  it.each(["en", "si", "ta"] as const)(
    "ready hint uses the %s dictionary entry once threshold is met",
    (lang) => {
      renderAtOptional(lang);
      act(() => { getCards()[0].click(); });
      expect(getReady().textContent?.trim()).toBe(pickText(UI.optionalHintReady, lang));
    },
  );

  it("toggling the SAME card on→off→on re-announces by clearing then repopulating the live region", () => {
    renderAtOptional("en");
    const expected = pickText(UI.optionalHintReady, "en");

    // 1st toggle ON — announce
    act(() => { getCards()[0].click(); });
    expect(getReady().textContent?.trim()).toBe(expected);

    // toggle OFF — must clear so the next ON is a real DOM mutation SR will re-read
    act(() => { getCards()[0].click(); });
    expect(getReady().textContent ?? "").toBe("");

    // 2nd toggle ON — re-announce (content transitions "" → text again)
    act(() => { getCards()[0].click(); });
    expect(getReady().textContent?.trim()).toBe(expected);

    // And once more for good measure: off → on still re-announces.
    act(() => { getCards()[0].click(); });
    expect(getReady().textContent ?? "").toBe("");
    act(() => { getCards()[0].click(); });
    expect(getReady().textContent?.trim()).toBe(expected);
  });

  it("selecting a second card keeps the ready text (does NOT regress to empty)", () => {
    renderAtOptional("en");
    const [c1, c2] = getCards();
    act(() => { c1.click(); });
    const expected = pickText(UI.optionalHintReady, "en");
    expect(getReady().textContent?.trim()).toBe(expected);
    act(() => { c2.click(); });
    expect(getReady().textContent?.trim()).toBe(expected);
  });
});
