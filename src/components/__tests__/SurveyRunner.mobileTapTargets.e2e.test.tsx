/**
 * E2E mobile finger-friendliness scenario for the questions stage:
 * verifies that every primary tap target meets the WCAG 2.5.5 ≥44px
 * recommendation, that the sticky bottom action bar separates targets
 * with non-zero spacing, and that the Next / Back interactions
 * navigate forward and backward through visible questions without
 * losing answers.
 *
 * Computed CSS sizes are not available in jsdom (Tailwind utilities
 * are not applied), so we assert the design contract via the Tailwind
 * size classes (`h-12` = 48px, `h-14` = 56px, `min-h-14` = 56px) that
 * map to the WCAG-compliant pixel sizes in the production CSS bundle,
 * plus the explicit `gap-2` spacing utility on the action bar.
 */
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
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

// h-12 → 48px, h-14 → 56px (Tailwind defaults). Both clear the WCAG 2.5.5
// ≥44px target. min-h-14 sets the min-height to 56px on choice rows.
const TAILWIND_HEIGHT_PX: Record<string, number> = {
  "h-12": 48,
  "h-14": 56,
  "min-h-14": 56,
};

const SURVEY: Survey = {
  slug: "mobile-tap",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      section: { en: "Sec", si: "කොටස", ta: "பகுதி" },
      label: { en: "First question", si: "පළමු", ta: "முதல்" },
      required: false,
    },
    {
      id: "q2",
      type: "text",
      section: { en: "Sec", si: "කොටස", ta: "பகுதி" },
      label: { en: "Second question", si: "දෙවැනි", ta: "இரண்டாம்" },
      required: false,
    },
  ],
};

function renderRunner() {
  return render(
    <I18nProvider>
      <SurveyRunner survey={SURVEY} initialLanguage="en" initialToken="tok" />
    </I18nProvider>,
  );
}

function getActionBar(): HTMLElement {
  const nav = document.querySelector("nav.fixed");
  if (!nav) throw new Error("sticky bottom action bar not found");
  return nav as HTMLElement;
}

function getButtonByAriaLabel(label: string): HTMLButtonElement {
  const btn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.getAttribute("aria-label") === label,
  );
  if (!btn) throw new Error(`button [aria-label="${label}"] not found`);
  return btn;
}

function getNextButton(): HTMLButtonElement {
  // The Next / forward button has no aria-label; identify it by the
  // localized text content + flex-1 sticky-bar class so we don't grab
  // an unrelated CTA.
  const text = pickText(UI.next, "en");
  const btn = Array.from(document.querySelectorAll<HTMLButtonElement>("nav.fixed button")).find(
    (b) => b.textContent?.includes(text),
  );
  if (!btn) throw new Error("Next button not found in action bar");
  return btn;
}

function getInput(): HTMLInputElement {
  const el = document.querySelector('main input[type="text"]') as HTMLInputElement | null;
  if (!el) throw new Error("question text input not found");
  return el;
}

function tapTargetHeightPx(el: Element): number {
  const cls = el.className.toString();
  let max = 0;
  for (const [token, px] of Object.entries(TAILWIND_HEIGHT_PX)) {
    if (new RegExp(`(?:^|\\s)${token}(?:\\s|$)`).test(cls)) {
      max = Math.max(max, px);
    }
  }
  return max;
}

describe("SurveyRunner — mobile finger-friendly controls (questions stage)", () => {
  it("Back / Save & exit / Next sticky-bar buttons all meet ≥44px tap targets", () => {
    renderRunner();
    const back = getButtonByAriaLabel(pickText(UI.back, "en"));
    const save = getButtonByAriaLabel(pickText(UI.saveExit, "en"));
    const next = getNextButton();

    for (const [name, btn] of [
      ["Back", back],
      ["Save & exit", save],
      ["Next", next],
    ] as const) {
      const h = tapTargetHeightPx(btn);
      expect(h, `${name} button height class`).toBeGreaterThanOrEqual(44);
    }
  });

  it("the question text input is at least 48px tall (h-12)", () => {
    renderRunner();
    const input = getInput();
    expect(tapTargetHeightPx(input)).toBeGreaterThanOrEqual(44);
  });

  it("sticky bottom action bar separates targets with non-zero gap spacing", () => {
    renderRunner();
    const inner = getActionBar().querySelector(":scope > div");
    expect(inner).not.toBeNull();
    const cls = (inner as HTMLElement).className;
    // Tailwind gap-2 = 0.5rem = 8px between flex children.
    expect(/(?:^|\s)gap-2(?:\s|$)/.test(cls)).toBe(true);
    // And the inner row is a flex container so the gap actually applies.
    expect(/(?:^|\s)flex(?:\s|$)/.test(cls)).toBe(true);
    // Padding around the bar so the targets are not flush against the
    // viewport edge — px-4 (16px) horizontally + py-3 (12px) vertically.
    expect(/(?:^|\s)px-4(?:\s|$)/.test(cls)).toBe(true);
    expect(/(?:^|\s)py-3(?:\s|$)/.test(cls)).toBe(true);
  });

  it("sticky bar pins to the bottom safely above the OS gesture area", () => {
    renderRunner();
    const nav = getActionBar();
    const cls = nav.className;
    expect(/(?:^|\s)fixed(?:\s|$)/.test(cls)).toBe(true);
    expect(/(?:^|\s)bottom-0(?:\s|$)/.test(cls)).toBe(true);
    // safe-bottom adds env(safe-area-inset-bottom) padding for iOS home bar.
    expect(/(?:^|\s)safe-bottom(?:\s|$)/.test(cls)).toBe(true);
  });

  it("Back button starts disabled on the first question and Next advances visible state", () => {
    renderRunner();

    // q1 visible, Back disabled.
    expect(document.body.textContent).toContain("First question");
    expect(getButtonByAriaLabel(pickText(UI.back, "en")).disabled).toBe(true);

    // Type something so we can verify the answer survives Next/Back.
    act(() => {
      fireEvent.change(getInput(), { target: { value: "answer-1" } });
    });
    expect(getInput().value).toBe("answer-1");

    // Tap Next → q2 becomes the current question.
    act(() => {
      getNextButton().click();
    });
    expect(document.body.textContent).toContain("Second question");
    expect(document.body.textContent).not.toContain("First question");
    // Back button is now enabled at q2.
    expect(getButtonByAriaLabel(pickText(UI.back, "en")).disabled).toBe(false);

    // Tap Back → q1 returns with the previously-typed value preserved.
    act(() => {
      getButtonByAriaLabel(pickText(UI.back, "en")).click();
    });
    expect(document.body.textContent).toContain("First question");
    expect(getInput().value).toBe("answer-1");
    // And Back is disabled again at q1.
    expect(getButtonByAriaLabel(pickText(UI.back, "en")).disabled).toBe(true);
  });
});
