/**
 * Swipe gestures on the questions stage:
 *   - swipe LEFT  → goNext (with next-unanswered skipping + validation)
 *   - swipe RIGHT → goBack (idx-1, no skipping)
 *   - sets navDirection so the slide animation matches (1 for forward,
 *     -1 for back) — asserted via QuestionView's `direction` prop, which
 *     this test reads off the rendered DOM by stubbing QuestionView.
 *   - mostly-vertical drags are ignored (scroll wins)
 *   - drags that begin on form controls are ignored (text selection wins)
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, act, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => {} }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/responses.functions", () => ({
  startResponse: vi.fn().mockResolvedValue({ id: "row", resumeToken: "tok" }),
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

// Replace QuestionView with a stub that exposes the question id and the
// last-seen `direction` prop so we can assert nav direction from the DOM.
vi.mock("@/components/survey/QuestionView", () => ({
  QuestionView: (props: { q: { id: string }; direction: 1 | -1 }) => (
    <div
      data-testid="q-stub"
      data-qid={props.q.id}
      data-dir={String(props.direction)}
    />
  ),
}));

import { SurveyRunner } from "@/components/SurveyRunner";

const SURVEY: Survey = {
  slug: "swipe-nav",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    { id: "q1", type: "text", section: { en: "S", si: "S", ta: "S" }, label: { en: "Q1", si: "Q1", ta: "Q1" }, required: false },
    { id: "q2", type: "text", section: { en: "S", si: "S", ta: "S" }, label: { en: "Q2", si: "Q2", ta: "Q2" }, required: false },
    { id: "q3", type: "text", section: { en: "S", si: "S", ta: "S" }, label: { en: "Q3", si: "Q3", ta: "Q3" }, required: false },
    { id: "q4", type: "text", section: { en: "S", si: "S", ta: "S" }, label: { en: "Q4", si: "Q4", ta: "Q4" }, required: false },
  ],
};

function renderRunner(initialAnswers: Record<string, unknown> = {}) {
  const utils = render(
    <I18nProvider>
      <SurveyRunner
        survey={SURVEY}
        initialToken="tok"
        initialAnswers={initialAnswers}
        initialLanguage="en"
      />
    </I18nProvider>,
  );
  return utils;
}

function activeQ() {
  return document.querySelector('[data-testid="q-stub"]') as HTMLElement;
}
function surface() {
  return document.querySelector(
    '[data-testid="question-swipe-surface"]',
  ) as HTMLElement;
}
function swipe(el: HTMLElement, fromX: number, toX: number, fromY = 100, toY = 100) {
  act(() => {
    fireEvent.pointerDown(el, { pointerId: 1, pointerType: "touch", clientX: fromX, clientY: fromY });
    fireEvent.pointerUp(el, { pointerId: 1, pointerType: "touch", clientX: toX, clientY: toY });
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("SurveyRunner — swipe navigation", () => {
  it("swipe LEFT advances to the next question with direction=1", async () => {
    renderRunner();
    await waitFor(() => expect(activeQ()).toBeTruthy());
    expect(activeQ().getAttribute("data-qid")).toBe("q1");

    swipe(surface(), 240, 80);

    await waitFor(() => expect(activeQ().getAttribute("data-qid")).toBe("q2"));
    expect(activeQ().getAttribute("data-dir")).toBe("1");
  });

  it("swipe RIGHT goes back one with direction=-1 (no skipping)", async () => {
    // Pre-answer q1 + q2 so we land on q3 by swiping forward twice first.
    renderRunner({ q1: "a", q2: "b" });
    swipe(surface(), 240, 80); // q1 → next-unanswered = q3
    await waitFor(() => expect(activeQ().getAttribute("data-qid")).toBe("q3"));

    swipe(surface(), 60, 240); // back
    await waitFor(() => expect(activeQ().getAttribute("data-qid")).toBe("q2"));
    expect(activeQ().getAttribute("data-dir")).toBe("-1");
  });

  it("swipe LEFT respects next-unanswered skipping (q1 with q2/q3 answered → q4)", async () => {
    renderRunner({ q2: "x", q3: "y" });
    expect(activeQ().getAttribute("data-qid")).toBe("q1");
    swipe(surface(), 240, 80);
    await waitFor(() => expect(activeQ().getAttribute("data-qid")).toBe("q4"));
    expect(activeQ().getAttribute("data-dir")).toBe("1");
  });

  it("mostly-vertical drag is ignored (scroll, not nav)", async () => {
    renderRunner();
    expect(activeQ().getAttribute("data-qid")).toBe("q1");
    // dx = -80 but dy = -200 → vertical wins
    swipe(surface(), 200, 120, 300, 100);
    // Wait a tick — should NOT advance.
    await new Promise((r) => setTimeout(r, 20));
    expect(activeQ().getAttribute("data-qid")).toBe("q1");
  });

  it("small jitter under the threshold is ignored", async () => {
    renderRunner();
    swipe(surface(), 200, 170); // |dx|=30 < 48
    await new Promise((r) => setTimeout(r, 20));
    expect(activeQ().getAttribute("data-qid")).toBe("q1");
  });

  it("swipe RIGHT on the first question is a no-op (no underflow)", async () => {
    renderRunner();
    swipe(surface(), 40, 240);
    await new Promise((r) => setTimeout(r, 20));
    expect(activeQ().getAttribute("data-qid")).toBe("q1");
  });

  it("mouse pointers do not trigger navigation (buttons own that path)", async () => {
    renderRunner();
    act(() => {
      fireEvent.pointerDown(surface(), { pointerId: 2, pointerType: "mouse", clientX: 240, clientY: 100 });
      fireEvent.pointerUp(surface(), { pointerId: 2, pointerType: "mouse", clientX: 60, clientY: 100 });
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(activeQ().getAttribute("data-qid")).toBe("q1");
  });
});
