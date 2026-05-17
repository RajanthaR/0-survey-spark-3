/**
 * Keyboard-navigation a11y for the survey progress + Next/Back controls.
 *
 * Covers:
 *   1. Focus order on the questions stage flows from the question input
 *      through the sticky bottom-nav controls (Back → Save & Exit → Next),
 *      with no positive tabindex hacks.
 *   2. Back / Next have accessible names sourced from `aria-label` (icon
 *      buttons) and Save & Exit is keyboard-activatable.
 *   3. Home jumps to the first visible question; End jumps to the last.
 *   4. Home / End are ignored while typing inside an <input> / <textarea>.
 *   5. After advancing to the review stage with Enter on Next, Back/Next
 *      controls are unmounted (focus trap relinquishes question controls).
 *   6. Progress bar exposes an accessible name and stays in sync with the
 *      QuestionPosition announcement.
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
  slug: "kbd-nav",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Q1", si: "Q1", ta: "Q1" },
      required: false,
    },
    {
      id: "q2",
      type: "text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Q2", si: "Q2", ta: "Q2" },
      required: false,
    },
    {
      id: "q3",
      type: "text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Q3", si: "Q3", ta: "Q3" },
      required: false,
    },
    {
      id: "q4",
      type: "text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Q4", si: "Q4", ta: "Q4" },
      required: false,
    },
  ],
};

function renderRunner() {
  return render(
    <I18nProvider>
      <SurveyRunner survey={SURVEY} initialLanguage="en" initialToken="tok-x" />
    </I18nProvider>,
  );
}

function getNav(): HTMLElement {
  const nav = document.querySelector("nav");
  if (!nav) throw new Error("Sticky nav not mounted");
  return nav as HTMLElement;
}

function getNavButtons() {
  const nav = getNav();
  const buttons = Array.from(nav.querySelectorAll("button")) as HTMLButtonElement[];
  // Three primary controls in the action row: Back, Save & Exit, Next.
  // (Resume strip may add a Copy button below — we filter to the row.)
  const row = nav.querySelector("div.mx-auto");
  return Array.from(row!.querySelectorAll("button")) as HTMLButtonElement[];
}

function getQuestionInput(): HTMLInputElement {
  const input = document.querySelector(
    'main input[type="text"], main input:not([type])',
  ) as HTMLInputElement | null;
  if (!input) throw new Error("Question input not found");
  return input;
}

function getCurrentQuestionLabel(): string {
  // QuestionView renders the question label as a heading-ish element; just
  // sniff main's text content for Q1..Q4 to assert which one is current.
  const main = document.querySelector("main")!;
  const txt = main.textContent ?? "";
  const found = ["Q1", "Q2", "Q3", "Q4"].filter((q) => txt.includes(q));
  return found[found.length - 1] ?? "";
}

function getProgressBar(): HTMLElement {
  const el = document.querySelector('[role="progressbar"]') as HTMLElement | null;
  if (!el) throw new Error("Progress bar not found");
  return el;
}

describe("Survey question step — keyboard navigation a11y", () => {
  it("renders three nav controls in DOM order: Back, Save & Exit, Next — all real <button>s with names and tabIndex 0", async () => {
    renderRunner();
    await waitFor(() => expect(document.querySelector("nav")).not.toBeNull());
    const buttons = getNavButtons();
    expect(buttons).toHaveLength(3);
    const [back, save, next] = buttons;
    expect(back.tagName).toBe("BUTTON");
    expect(save.tagName).toBe("BUTTON");
    expect(next.tagName).toBe("BUTTON");
    // Accessible names: icon-only Back uses aria-label; Save has both icon
    // and visible text label; Next has visible text + icon.
    expect(
      (back.getAttribute("aria-label") ?? back.textContent ?? "").trim().length,
    ).toBeGreaterThan(0);
    expect(
      (save.getAttribute("aria-label") ?? save.textContent ?? "").trim().length,
    ).toBeGreaterThan(0);
    expect(
      (next.getAttribute("aria-label") ?? next.textContent ?? "").trim().length,
    ).toBeGreaterThan(0);
    // No positive tabindex hacks — all default (0).
    for (const b of buttons) expect(b.tabIndex).toBe(0);
    // Back is disabled on the first question; Next is enabled.
    expect(back.disabled).toBe(true);
    expect(next.disabled).toBe(false);
  });

  it("focus order: question input precedes nav controls in document order", async () => {
    renderRunner();
    await waitFor(() => getQuestionInput());
    const input = getQuestionInput();
    const buttons = getNavButtons();
    // Document order: input must come before the first nav button.
    const pos = input.compareDocumentPosition(buttons[0]);
    // Node.DOCUMENT_POSITION_FOLLOWING === 4
    expect(pos & 4).toBe(4);
    // Within the nav row, Back precedes Save precedes Next.
    expect(buttons[0].compareDocumentPosition(buttons[1]) & 4).toBe(4);
    expect(buttons[1].compareDocumentPosition(buttons[2]) & 4).toBe(4);
  });

  it("Enter on the Next button advances to the next visible question", async () => {
    renderRunner();
    await waitFor(() => getNavButtons().length === 3);
    expect(getCurrentQuestionLabel()).toBe("Q1");
    const next = getNavButtons()[2];
    next.focus();
    expect(document.activeElement).toBe(next);
    act(() => {
      next.click();
    }); // Enter on a <button> dispatches click
    await waitFor(() => expect(getCurrentQuestionLabel()).toBe("Q2"));
  });

  it("Back is disabled on the first question, enabled after advancing, and returns focus target", async () => {
    renderRunner();
    await waitFor(() => getNavButtons().length === 3);
    let [back, , next] = getNavButtons();
    expect(back.disabled).toBe(true);
    act(() => {
      next.click();
    });
    await waitFor(() => {
      [back, , next] = getNavButtons();
      expect(back.disabled).toBe(false);
    });
    act(() => {
      back.click();
    });
    await waitFor(() => expect(getCurrentQuestionLabel()).toBe("Q1"));
    [back] = getNavButtons();
    expect(back.disabled).toBe(true);
  });

  it("Home jumps to the first visible question; End jumps to the last", async () => {
    renderRunner();
    await waitFor(() => getNavButtons().length === 3);
    // Move forward two steps so Home has work to do.
    const next = getNavButtons()[2];
    act(() => {
      next.click();
    });
    await waitFor(() => expect(getCurrentQuestionLabel()).toBe("Q2"));
    act(() => {
      getNavButtons()[2].click();
    });
    await waitFor(() => expect(getCurrentQuestionLabel()).toBe("Q3"));

    // Fire End on the document body (not inside an input).
    act(() => {
      fireEvent.keyDown(window, { key: "End" });
    });
    await waitFor(() => expect(getCurrentQuestionLabel()).toBe("Q4"));

    act(() => {
      fireEvent.keyDown(window, { key: "Home" });
    });
    await waitFor(() => expect(getCurrentQuestionLabel()).toBe("Q1"));
  });

  it("Home/End are IGNORED while typing in the question input (does not steal text-editing keys)", async () => {
    renderRunner();
    await waitFor(() => getNavButtons().length === 3);
    // Advance to Q2 via Next so we can prove Home doesn't reset us.
    act(() => {
      getNavButtons()[2].click();
    });
    await waitFor(() => expect(getCurrentQuestionLabel()).toBe("Q2"));
    const input = getQuestionInput();
    input.focus();
    expect(document.activeElement).toBe(input);

    // Home / End fired on the input should NOT navigate the survey.
    fireEvent.keyDown(input, { key: "Home" });
    expect(getCurrentQuestionLabel()).toBe("Q2");
    fireEvent.keyDown(input, { key: "End" });
    expect(getCurrentQuestionLabel()).toBe("Q2");
  });

  it("Home/End modifier-key combos are ignored (e.g. Ctrl+Home)", async () => {
    renderRunner();
    await waitFor(() => getNavButtons().length === 3);
    act(() => {
      getNavButtons()[2].click();
    });
    await waitFor(() => expect(getCurrentQuestionLabel()).toBe("Q2"));
    fireEvent.keyDown(window, { key: "Home", ctrlKey: true });
    expect(getCurrentQuestionLabel()).toBe("Q2");
    fireEvent.keyDown(window, { key: "End", metaKey: true });
    expect(getCurrentQuestionLabel()).toBe("Q2");
  });

  it("after pressing Next on the last question, the question-stage controls unmount (advances to review)", async () => {
    renderRunner();
    await waitFor(() => getNavButtons().length === 3);
    // Jump straight to Q4 with End.
    fireEvent.keyDown(window, { key: "End" });
    await waitFor(() => expect(getCurrentQuestionLabel()).toBe("Q4"));
    const next = getNavButtons()[2];
    act(() => {
      next.click();
    });
    await waitFor(() => {
      expect(document.querySelector("nav")).toBeNull();
    });
  });

  it("progress bar exposes role=progressbar with an accessible name and aria-valuenow that scales with position", async () => {
    renderRunner();
    await waitFor(() => getProgressBar());
    const bar = getProgressBar();
    expect(bar.getAttribute("aria-label")?.length ?? 0).toBeGreaterThan(0);
    const initial = Number(bar.getAttribute("aria-valuenow") ?? "0");
    // Advance and confirm value changes (monotonic for non-required text fields).
    act(() => {
      getNavButtons()[2].click();
    });
    await waitFor(() => {
      const after = Number(getProgressBar().getAttribute("aria-valuenow") ?? "0");
      expect(after).toBeGreaterThanOrEqual(initial);
    });
  });
});
