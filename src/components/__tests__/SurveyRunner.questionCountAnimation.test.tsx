/**
 * UI test for the QuestionCount → QuestionPosition transition between
 * the intro and the first question.
 *
 * Two distinct things "animate" across this transition and both are
 * pinned here:
 *
 *   1. The motion contract on the wrapping `motion.section`s. Intro
 *      uses `initial={opacity:0,y:12} animate={opacity:1,y:0}
 *      exit={opacity:0,y:-12}`; the first `QuestionView` uses the
 *      sideways slide `initial={opacity:0,x:24} animate={opacity:1,x:0}
 *      exit={opacity:0,x:-24} transition={duration:0.25}`. We capture
 *      these by mocking `framer-motion` so each `motion.<tag>` renders
 *      the underlying tag with the JSON-serialized animation props as
 *      `data-motion-*` attributes.
 *   2. The DOM transition itself: the intro's `<QuestionCount>` (the
 *      "N questions" estimate) is unmounted, and the header's
 *      `<QuestionPosition>` (the live `Question 1 of N` indicator) is
 *      mounted with `role="status" aria-live="polite" aria-atomic="true"`
 *      so screen readers announce the new position as the user lands on
 *      the first question.
 *
 * The test drives the real Start → Agree → Continue click flow so the
 * stage transitions exactly mirror what a user would do, then asserts
 * (1) and (2) on the post-transition DOM.
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { I18nProvider } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

// ---- module mocks (must be declared before importing SurveyRunner) ----

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

/**
 * `framer-motion` mock that records the animation contract on every
 * `motion.<tag>` element. We keep it intentionally low-tech: the
 * recording tag renders the underlying HTML element (no animation
 * runtime) and stamps `data-motion-initial`, `data-motion-animate`,
 * `data-motion-exit`, and `data-motion-transition` so the test can
 * assert exact prop shapes by JSON-comparison. AnimatePresence is a
 * passthrough — jsdom can't run the timeline anyway, and `mode="wait"`
 * resolves to "child unmounts immediately when key changes" without it.
 */
vi.mock("framer-motion", () => {
  const passthrough = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
      const {
        initial,
        animate,
        exit,
        transition,
        layout,
        layoutId,
        whileHover,
        whileTap,
        whileFocus,
        whileDrag,
        whileInView,
        drag,
        dragConstraints,
        variants,
        custom,
        onAnimationStart,
        onAnimationComplete,
        ...rest
      } = props as Record<string, unknown>;
      const motionAttrs: Record<string, string> = {};
      if (initial !== undefined) motionAttrs["data-motion-initial"] = JSON.stringify(initial);
      if (animate !== undefined) motionAttrs["data-motion-animate"] = JSON.stringify(animate);
      if (exit !== undefined) motionAttrs["data-motion-exit"] = JSON.stringify(exit);
      if (transition !== undefined)
        motionAttrs["data-motion-transition"] = JSON.stringify(transition);
      return React.createElement(tag, { ...rest, ...motionAttrs, ref });
    });
  return {
    motion: new Proxy({}, { get: (_t, key: string) => passthrough(key) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => false,
  };
});

import { SurveyRunner } from "@/components/SurveyRunner";

// ---- fixture survey: 2 required text questions, no consent items ---

const SURVEY: Survey = {
  slug: "anim-fixture",
  title: { en: "Anim fixture", si: "Anim", ta: "Anim" },
  subtitle: { en: "subtitle", si: "subtitle", ta: "subtitle" },
  estimatedMinutes: 1,
  consent: [],
  questions: Array.from({ length: 2 }, (_, i) => ({
    id: `q${i + 1}`,
    type: "text" as const,
    section: { en: "S", si: "S", ta: "S" },
    label: { en: `Q${i + 1}`, si: `Q${i + 1}`, ta: `Q${i + 1}` },
    required: true,
  })),
};

function renderRunner() {
  return render(
    <I18nProvider>
      <SurveyRunner survey={SURVEY} initialLanguage="en" />
    </I18nProvider>,
  );
}

/** Walk up to find the nearest mocked `motion.<tag>` ancestor. */
function nearestMotionAncestor(el: HTMLElement | null): HTMLElement | null {
  let cur: HTMLElement | null = el;
  while (cur && !cur.hasAttribute("data-motion-animate")) cur = cur.parentElement;
  return cur;
}

describe("SurveyRunner — QuestionCount → QuestionPosition animation contract", () => {
  it("intro mounts QuestionCount inside the intro motion.section with the slide-up animation contract", async () => {
    renderRunner();
    const count = await screen.findByTestId("question-count");
    expect(count.textContent?.trim()).toBe("2 questions");

    // The intro <QuestionCount> lives inside an intro motion.section
    // whose contract is opacity 0→1 + y 12→0, exit y -12. We assert the
    // exact JSON to catch silent prop drift (e.g. an opacity-only edit
    // would still "look" like animation but lose the slide).
    const motionSection = nearestMotionAncestor(count);
    expect(motionSection).not.toBeNull();
    expect(JSON.parse(motionSection!.getAttribute("data-motion-initial")!)).toEqual({
      opacity: 0,
      y: 12,
    });
    expect(JSON.parse(motionSection!.getAttribute("data-motion-animate")!)).toEqual({
      opacity: 1,
      y: 0,
    });
    expect(JSON.parse(motionSection!.getAttribute("data-motion-exit")!)).toEqual({
      opacity: 0,
      y: -12,
    });

    // QuestionPosition must NOT be in the DOM yet — the live progress
    // header only mounts when stage advances to "questions".
    expect(screen.queryByTestId("question-position")).toBeNull();
  });

  it("after Start → Agree → Continue, QuestionCount unmounts and QuestionPosition mounts with the live-region announcement contract", async () => {
    const user = userEvent.setup();
    renderRunner();

    await screen.findByTestId("question-count");
    await user.click(await screen.findByRole("button", { name: /^Start/ }));
    // consent stage → required is empty, so the agree button is the only CTA.
    await user.click(await screen.findByRole("button", { name: /I agree and want to continue/ }));
    // consent-optional stage → "Continue" advances to questions.
    await user.click(await screen.findByRole("button", { name: /Continue/ }));

    // The live progress indicator appears, with the canonical localized
    // "Question 1 of 2" string and the announce contract (role=status +
    // aria-live=polite + aria-atomic=true) so AT speaks the new position
    // exactly when the question card slides in.
    const position = await screen.findByTestId("question-position");
    expect(position.textContent?.trim()).toBe("Question 1 of 2");
    expect(position.getAttribute("role")).toBe("status");
    expect(position.getAttribute("aria-live")).toBe("polite");
    expect(position.getAttribute("aria-atomic")).toBe("true");

    // The intro's QuestionCount is gone — proves the intro section
    // unmounted under AnimatePresence rather than stacking with the
    // questions stage.
    await waitFor(() => expect(screen.queryByTestId("question-count")).toBeNull());

    // The first QuestionView's wrapping motion.section uses the
    // sideways slide-in contract (x: 24 → 0, exit x: -24, 0.25s). Pin
    // the exact animation prop set so a regression that changes the
    // direction or duration of the per-question entrance is caught.
    const questionLabel = await screen.findByText("Q1");
    const questionMotion = nearestMotionAncestor(questionLabel as HTMLElement);
    expect(questionMotion).not.toBeNull();
    expect(JSON.parse(questionMotion!.getAttribute("data-motion-initial")!)).toEqual({
      opacity: 0,
      x: 24,
    });
    expect(JSON.parse(questionMotion!.getAttribute("data-motion-animate")!)).toEqual({
      opacity: 1,
      x: 0,
    });
    expect(JSON.parse(questionMotion!.getAttribute("data-motion-exit")!)).toEqual({
      opacity: 0,
      x: -24,
    });
    expect(JSON.parse(questionMotion!.getAttribute("data-motion-transition")!)).toEqual({
      duration: 0.25,
    });
  });
});
