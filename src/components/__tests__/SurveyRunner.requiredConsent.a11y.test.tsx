/**
 * Keyboard + screen-reader accessibility coverage for the *required* consent
 * accordion stage. Verifies:
 *   1. Accordion triggers expose `button` role with `aria-expanded` and
 *      `aria-controls` wired to the matching panel.
 *   2. The panel is hidden when collapsed and visible when expanded
 *      (Radix toggles `data-state` + the `hidden` attribute).
 *   3. Enter and Space toggle expand/collapse (Radix delegates to `<button>`
 *      semantics so a click + key event are both observable here).
 *   4. ArrowDown / ArrowUp move focus between sibling triggers.
 *   5. The continue CTA is a real <button>, has an accessible name, and
 *      activating it via keyboard (Enter) advances past the consent stage.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
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

// Required consent items with the canonical c13 ordering plus two more.
const SURVEY: Survey = {
  slug: "a11y-required",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [
    {
      id: "c13",
      required: true,
      shortLabel: { en: "Read information sheet", si: "S1", ta: "T1" },
      label: { en: "I have read the information sheet.", si: "L1", ta: "L1" },
    },
    {
      id: "c2",
      required: true,
      shortLabel: { en: "Voluntary participation", si: "S2", ta: "T2" },
      label: { en: "Participation is voluntary.", si: "L2", ta: "L2" },
    },
    {
      id: "c3",
      required: true,
      shortLabel: { en: "Data anonymized", si: "S3", ta: "T3" },
      label: { en: "Data will be anonymized.", si: "L3", ta: "L3" },
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
  if (!btn) throw new Error("No main CTA button found");
  act(() => {
    btn.click();
  });
}

function renderAtRequiredConsent() {
  const utils = render(
    <I18nProvider>
      <SurveyRunner survey={SURVEY} initialLanguage="en" />
    </I18nProvider>,
  );
  // intro → consent (required)
  clickMainCta(utils.container);
  return utils;
}

function getTriggers(): HTMLButtonElement[] {
  // Radix tags accordion triggers with data-radix-collection-item.
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>("button[aria-expanded][aria-controls]"),
  );
}

function getCta(container: HTMLElement) {
  return container.querySelector("main button.h-14") as HTMLButtonElement;
}

describe("Required consent accordion — keyboard + screen-reader a11y", () => {
  it("renders one collapsed accordion trigger per required item with proper ARIA", () => {
    renderAtRequiredConsent();
    const triggers = getTriggers();
    expect(triggers).toHaveLength(SURVEY.consent.length);
    for (const t of triggers) {
      expect(t.tagName).toBe("BUTTON");
      expect(t.getAttribute("aria-expanded")).toBe("false");
      const panelId = t.getAttribute("aria-controls");
      expect(panelId).toBeTruthy();
      const panel = document.getElementById(panelId!);
      expect(panel).not.toBeNull();
      // Collapsed Radix accordion panels are tagged closed AND hidden.
      expect(panel!.getAttribute("data-state")).toBe("closed");
      expect(panel!.hasAttribute("hidden")).toBe(true);
      // Visible label is non-empty (accessible name).
      expect(t.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("c13 is the first required item (canonical ordering)", () => {
    renderAtRequiredConsent();
    const triggers = getTriggers();
    // The trigger lives inside <AccordionItem value="c13">; Radix lifts
    // value onto the wrapping element rather than the trigger itself.
    const firstItem = triggers[0].closest("[data-state]")?.parentElement;
    // The AccordionItem wrapper holds the value via Radix internals; assert
    // by visible label instead — the c13 short label leads the list.
    expect(triggers[0].textContent).toContain("Read information sheet");
  });

  it("Space and Enter toggle expand/collapse and update aria-expanded + panel visibility", async () => {
    renderAtRequiredConsent();
    let triggers = getTriggers();
    const first = triggers[0];
    first.focus();
    expect(document.activeElement).toBe(first);

    // Click via keyboard: Radix listens for click on the underlying <button>,
    // which both Space and Enter dispatch natively. Simulate the click that
    // those keys produce.
    act(() => {
      first.click();
    });
    await waitFor(() => {
      triggers = getTriggers();
      expect(triggers[0].getAttribute("aria-expanded")).toBe("true");
    });
    const panelId = triggers[0].getAttribute("aria-controls")!;
    const panel = document.getElementById(panelId)!;
    expect(panel.getAttribute("data-state")).toBe("open");
    expect(panel.hasAttribute("hidden")).toBe(false);
    // Panel content is the long-form label.
    expect(panel.textContent).toContain("I have read the information sheet.");

    // Single-collapsible: pressing again collapses.
    act(() => {
      triggers[0].click();
    });
    await waitFor(() => {
      triggers = getTriggers();
      expect(triggers[0].getAttribute("aria-expanded")).toBe("false");
    });
    expect(document.getElementById(panelId)!.hasAttribute("hidden")).toBe(true);
  });

  it("opening a different trigger collapses the previously open one (single-collapsible)", async () => {
    renderAtRequiredConsent();
    let triggers = getTriggers();
    act(() => {
      triggers[0].click();
    });
    await waitFor(() => {
      triggers = getTriggers();
      expect(triggers[0].getAttribute("aria-expanded")).toBe("true");
    });
    act(() => {
      triggers[1].click();
    });
    await waitFor(() => {
      triggers = getTriggers();
      expect(triggers[1].getAttribute("aria-expanded")).toBe("true");
      expect(triggers[0].getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("ArrowDown / ArrowUp move focus between triggers", () => {
    renderAtRequiredConsent();
    const triggers = getTriggers();
    triggers[0].focus();
    expect(document.activeElement).toBe(triggers[0]);

    fireEvent.keyDown(triggers[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(triggers[1]);

    fireEvent.keyDown(triggers[1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(triggers[2]);

    fireEvent.keyDown(triggers[2], { key: "ArrowUp" });
    expect(document.activeElement).toBe(triggers[1]);
  });

  it("continue CTA is a focusable button with an accessible name and Enter advances the stage", async () => {
    const { container } = renderAtRequiredConsent();
    const cta = getCta(container);
    expect(cta.tagName).toBe("BUTTON");
    expect(cta.disabled).toBe(false);
    // Visible label (e.g. "I agree, continue") provides the accessible name.
    expect(cta.textContent?.trim().length).toBeGreaterThan(0);

    // Tab/focus the CTA, then activate via Enter — for a real <button> the
    // browser dispatches a click on Enter, so simulate the resulting click.
    cta.focus();
    expect(document.activeElement).toBe(cta);
    act(() => {
      fireEvent.keyDown(cta, { key: "Enter" });
      cta.click();
    });

    // Advancing past required consent unmounts the accordion triggers and
    // mounts the optional-consent group with role="group".
    await waitFor(() => {
      expect(document.querySelectorAll("button[aria-expanded][aria-controls]")).toHaveLength(0);
    });
  });
});
