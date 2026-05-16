/**
 * E2E: progress header live-region announcements.
 *
 * After every Next click the localized "Question N of M" / "ප්‍රශ්න N / M" /
 * "கேள்விகள் N / M" text in the sticky header must update, and the node
 * carrying that text must keep its `aria-live="polite"`, `aria-atomic="true"`,
 * `role="status"` wiring so screen readers re-announce the new position
 * each time. This file covers all three languages end-to-end through the
 * full Next-click sequence Q1 → Q2 → Q3 → Q4 → Q5.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { I18nProvider, type Lang } from "@/lib/i18n";
import { formatQuestionPosition } from "@/lib/format";
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

const TOTAL = 5;
const SURVEY: Survey = {
  slug: "e2e-progress-live",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: Array.from({ length: TOTAL }, (_, i) => ({
    id: `q${i + 1}`,
    type: "text" as const,
    section: { en: "S", si: "කොටස", ta: "பகுதி" },
    label: {
      en: `Question ${i + 1}`,
      si: `ප්‍රශ්නය ${i + 1}`,
      ta: `கேள்வி ${i + 1}`,
    },
    required: true,
  })),
};

const SAMPLE_INPUT: Record<Lang, string> = {
  en: "answer",
  si: "පිළිතුර",
  ta: "பதில்",
};

function renderRunner(lang: Lang) {
  return render(
    <I18nProvider>
      <SurveyRunner survey={SURVEY} initialToken="tok" initialLanguage={lang} />
    </I18nProvider>,
  );
}

function position(): HTMLElement {
  return screen.getByTestId("question-position");
}

function clickNext(container: HTMLElement, value: string) {
  const input = container.querySelector("input[type=text]") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  const nextBtn = container.querySelector("nav button.flex-1") as HTMLButtonElement;
  if (!nextBtn) throw new Error("Next button not found");
  act(() => {
    nextBtn.click();
  });
}

function assertLiveRegionWiring(node: HTMLElement) {
  expect(node.getAttribute("aria-live")).toBe("polite");
  expect(node.getAttribute("aria-atomic")).toBe("true");
  expect(node.getAttribute("role")).toBe("status");
}

describe("SurveyRunner progress header — localized aria-live announcements per Next click", () => {
  const langs: Lang[] = ["en", "si", "ta"];

  for (const lang of langs) {
    it(`${lang}: every Next click updates the live region with the localized position text`, async () => {
      const { container } = renderRunner(lang);
      const node = position();

      // Live-region wiring must be present on initial render.
      assertLiveRegionWiring(node);

      // The same node must persist (so the AT keeps observing it) AND its
      // text must equal the localized "current/total" string after every
      // Next click — no stale value, no language fallback.
      const initialNode = node;
      for (let step = 1; step <= TOTAL; step++) {
        const expected = formatQuestionPosition(step, TOTAL, lang);
        await waitFor(() => expect(position().textContent?.trim()).toBe(expected));
        // Wiring survives re-renders triggered by the Next click.
        assertLiveRegionWiring(position());
        // Same DOM node identity → the live region is updated in place,
        // which is what makes screen readers re-announce.
        expect(position()).toBe(initialNode);

        if (step < TOTAL) {
          // Use a value unique per step so React commits a state change.
          clickNext(container, `${SAMPLE_INPUT[lang]}-${step}`);
        }
      }
    });
  }

  it("the localized announcement text is genuinely different per language (guards against EN fallback)", () => {
    const en = formatQuestionPosition(2, TOTAL, "en");
    const si = formatQuestionPosition(2, TOTAL, "si");
    const ta = formatQuestionPosition(2, TOTAL, "ta");
    expect(new Set([en, si, ta]).size).toBe(3);
    expect(si.startsWith("ප්‍රශ්න")).toBe(true);
    expect(ta.startsWith("கேள்விகள்")).toBe(true);
    expect(en).toMatch(/^Question \d+ of \d+$/);
  });
});
