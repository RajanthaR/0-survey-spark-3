/**
 * Keyboard navigation on the questions stage:
 *   - ArrowRight / PageDown → go to next question
 *   - ArrowLeft  / PageUp   → go back
 *   - Enter / Space on the focused Next button advance (native button activation)
 *   - After every transition, focus returns to the sticky-bar Next button
 *     (or Back button on a backward transition) so the user can keep
 *     pressing Enter / Space to advance without re-Tabbing.
 *   - Keys are ignored when focus is in a text input / textarea so
 *     they don't fight text editing.
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

// Stub QuestionView so it exposes only a focusable element that is NOT
// an input — otherwise the global key handler would skip our key events.
vi.mock("@/components/survey/QuestionView", () => ({
  QuestionView: (props: { q: { id: string } }) => (
    <section>
      <h2>{props.q.id}</h2>
      <button data-testid="q-focusable">answer-area</button>
      <div data-testid="q-stub" data-qid={props.q.id} />
    </section>
  ),
}));

import { SurveyRunner } from "@/components/SurveyRunner";

const SURVEY: Survey = {
  slug: "kbd-nav",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    { id: "q1", type: "text", section: { en: "S", si: "S", ta: "S" }, label: { en: "Q1", si: "Q1", ta: "Q1" }, required: false },
    { id: "q2", type: "text", section: { en: "S", si: "S", ta: "S" }, label: { en: "Q2", si: "Q2", ta: "Q2" }, required: false },
    { id: "q3", type: "text", section: { en: "S", si: "S", ta: "S" }, label: { en: "Q3", si: "Q3", ta: "Q3" }, required: false },
  ],
};

function renderRunner() {
  return render(
    <I18nProvider>
      <SurveyRunner
        survey={SURVEY}
        initialToken="tok"
        initialAnswers={{}}
        initialLanguage="en"
      />
    </I18nProvider>,
  );
}

const qid = () =>
  (document.querySelector('[data-testid="q-stub"]') as HTMLElement).getAttribute("data-qid");
const nextBtn = () =>
  document.querySelector('[data-testid="next-button"]') as HTMLButtonElement;
const backBtn = () =>
  document.querySelector('[aria-label="Back"]') as HTMLButtonElement;

beforeEach(() => {
  window.localStorage.clear();
});

describe("SurveyRunner — keyboard navigation + sticky-bar focus", () => {
  it("ArrowRight advances; focus lands on the Next button", async () => {
    renderRunner();
    await waitFor(() => expect(qid()).toBe("q1"));
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    await waitFor(() => expect(qid()).toBe("q2"));
    await waitFor(() => expect(document.activeElement).toBe(nextBtn()));
  });

  it("ArrowLeft goes back; focus lands on the Back button", async () => {
    renderRunner();
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    await waitFor(() => expect(qid()).toBe("q2"));
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    await waitFor(() => expect(qid()).toBe("q3"));
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowLeft" });
    });
    await waitFor(() => expect(qid()).toBe("q2"));
    // Back is enabled at q2 (idx > 0), so focus lands on the Back button.
    await waitFor(() => expect(document.activeElement).toBe(backBtn()));
  });

  it("Enter on the focused Next button advances and refocuses Next", async () => {
    renderRunner();
    await waitFor(() => expect(qid()).toBe("q1"));
    await waitFor(() => expect(document.activeElement).toBe(nextBtn()));
    act(() => {
      nextBtn().click(); // native Enter/Space on a button == click
    });
    await waitFor(() => expect(qid()).toBe("q2"));
    await waitFor(() => expect(document.activeElement).toBe(nextBtn()));
  });

  it("PageDown / PageUp also navigate forward / back", async () => {
    renderRunner();
    act(() => {
      fireEvent.keyDown(window, { key: "PageDown" });
    });
    await waitFor(() => expect(qid()).toBe("q2"));
    act(() => {
      fireEvent.keyDown(window, { key: "PageUp" });
    });
    await waitFor(() => expect(qid()).toBe("q1"));
  });

  it("Arrow keys are ignored when focus is inside a text input", async () => {
    renderRunner();
    await waitFor(() => expect(qid()).toBe("q1"));
    // Simulate focus inside an input by dispatching the key event from one.
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    act(() => {
      fireEvent.keyDown(input, { key: "ArrowRight" });
    });
    // Still on q1 — global handler bailed because target.tagName === "INPUT".
    expect(qid()).toBe("q1");
    document.body.removeChild(input);
  });

  it("modifier keys (Alt/Ctrl/Meta) on Arrow are ignored", async () => {
    renderRunner();
    await waitFor(() => expect(qid()).toBe("q1"));
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowRight", ctrlKey: true });
      fireEvent.keyDown(window, { key: "ArrowRight", metaKey: true });
      fireEvent.keyDown(window, { key: "ArrowRight", altKey: true });
    });
    expect(qid()).toBe("q1");
  });
});