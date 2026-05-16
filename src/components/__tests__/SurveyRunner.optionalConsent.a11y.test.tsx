import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { I18nProvider, UI, pickText } from "@/lib/i18n";
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

// ── Fixture: 3 optional consent cards, no required ones ──────────
const SURVEY: Survey = {
  slug: "a11y-optional",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [
    { id: "o1", required: false, label: { en: "Opt one", si: "අ1", ta: "த1" } },
    { id: "o2", required: false, label: { en: "Opt two", si: "අ2", ta: "த2" } },
    { id: "o3", required: false, label: { en: "Opt three", si: "අ3", ta: "த3" } },
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
  if (!btn) throw new Error("No main CTA button found");
  act(() => { btn.click(); });
}

function renderAtOptionalStage(lang: "en" | "si" | "ta" = "en") {
  const utils = render(
    <I18nProvider>
      <SurveyRunner survey={SURVEY} initialLanguage={lang} />
    </I18nProvider>,
  );
  // intro → consent
  clickMainCta(utils.container);
  // consent (no required items) → consent-optional
  clickMainCta(utils.container);
  return utils;
}

function getCards(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[role="switch"]'),
  );
}

describe("OptionalConsentPanel — keyboard accessibility", () => {
  it("renders cards inside an aria-labelled group with switch semantics", () => {
    renderAtOptionalStage();
    const group = screen.getByRole("group");
    expect(group.getAttribute("aria-label")).toBeTruthy();
    const cards = getCards();
    expect(cards).toHaveLength(3);
    for (const c of cards) {
      expect(c.getAttribute("aria-checked")).toBe("false");
    }
  });

  it("Enter and Space toggle aria-checked without scrolling the page", () => {
    renderAtOptionalStage();
    let cards = getCards();
    cards[0].focus();

    let prevented = !fireEvent.keyDown(cards[0], { key: " ", cancelable: true });
    expect(prevented).toBe(true); // preventDefault called → no page scroll
    cards = getCards();
    expect(cards[0].getAttribute("aria-checked")).toBe("true");

    prevented = !fireEvent.keyDown(cards[0], { key: " ", cancelable: true });
    expect(prevented).toBe(true);
    cards = getCards();
    expect(cards[0].getAttribute("aria-checked")).toBe("false");

    fireEvent.keyDown(cards[1], { key: "Enter" });
    cards = getCards();
    expect(cards[1].getAttribute("aria-checked")).toBe("true");
  });

  it("Arrow keys move focus between cards and wrap around", () => {
    renderAtOptionalStage();
    const cards = getCards();
    cards[0].focus();
    expect(document.activeElement).toBe(cards[0]);

    fireEvent.keyDown(cards[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(cards[1]);

    fireEvent.keyDown(cards[1], { key: "ArrowRight" });
    expect(document.activeElement).toBe(cards[2]);

    // Wrap forward
    fireEvent.keyDown(cards[2], { key: "ArrowDown" });
    expect(document.activeElement).toBe(cards[0]);

    // Wrap backward
    fireEvent.keyDown(cards[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(cards[2]);

    fireEvent.keyDown(cards[2], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(cards[1]);
  });

  it("Home / End jump to first and last card", () => {
    renderAtOptionalStage();
    const cards = getCards();
    cards[1].focus();

    fireEvent.keyDown(cards[1], { key: "End" });
    expect(document.activeElement).toBe(cards[cards.length - 1]);

    fireEvent.keyDown(cards[cards.length - 1], { key: "Home" });
    expect(document.activeElement).toBe(cards[0]);
  });

  it("announces toggle state changes via an assertive live region (EN)", () => {
    renderAtOptionalStage();
    const live = screen.getByTestId("optional-toggle-live");
    expect(live.getAttribute("aria-live")).toBe("assertive");
    expect(live.getAttribute("aria-atomic")).toBe("true");
    expect(live.textContent).toBe("");

    let cards = getCards();
    fireEvent.keyDown(cards[0], { key: " ", cancelable: true });
    expect(screen.getByTestId("optional-toggle-live").textContent).toBe(
      "Opt one — Selected",
    );

    cards = getCards();
    fireEvent.keyDown(cards[0], { key: " ", cancelable: true });
    expect(screen.getByTestId("optional-toggle-live").textContent).toBe(
      "Opt one — Deselected",
    );

    // Continue-now hint also announces via aria-live=polite.
    cards = getCards();
    fireEvent.keyDown(cards[1], { key: "Enter" });
    const polite = document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(polite.textContent).toBe("You can continue now.");
  });

  it.each([
    ["si", "අ1"] as const,
    ["ta", "த1"] as const,
  ])(
    "announces Selected/Deselected in %s using the localized dictionary entry",
    (lang, labelText) => {
      renderAtOptionalStage(lang);
      const live = screen.getByTestId("optional-toggle-live");
      expect(live.textContent).toBe("");

      const selectedWord = pickText(UI.selected, lang);
      const deselectedWord = pickText(UI.deselected, lang);

      // Sanity-check the dictionary actually localized (no English fallback).
      expect(selectedWord).not.toBe(pickText(UI.selected, "en"));
      expect(deselectedWord).not.toBe(pickText(UI.deselected, "en"));
      // Sinhala block U+0D80–U+0DFF, Tamil block U+0B80–U+0BFF.
      const scriptRe = lang === "si" ? /[\u0D80-\u0DFF]/ : /[\u0B80-\u0BFF]/;
      expect(scriptRe.test(selectedWord)).toBe(true);
      expect(scriptRe.test(deselectedWord)).toBe(true);

      // Toggle ON → "<label> — <Selected localized>"
      let cards = getCards();
      fireEvent.keyDown(cards[0], { key: " ", cancelable: true });
      expect(screen.getByTestId("optional-toggle-live").textContent).toBe(
        `${labelText} — ${selectedWord}`,
      );

      // Toggle OFF → "<label> — <Deselected localized>"
      cards = getCards();
      fireEvent.keyDown(cards[0], { key: " ", cancelable: true });
      expect(screen.getByTestId("optional-toggle-live").textContent).toBe(
        `${labelText} — ${deselectedWord}`,
      );
    },
  );
});
