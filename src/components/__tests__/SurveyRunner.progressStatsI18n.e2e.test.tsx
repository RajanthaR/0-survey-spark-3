/**
 * E2E: toggling the language halfway through the survey must instantly
 * relocalize every "progress statistics" string the user can see in the
 * sticky header — the localized question-position text ("Question N of M" /
 * "ප්‍රශ්න N / M" / "கேள்விகள் N / M"), the Progress bar's localized
 * `aria-label` ("Progress" / "ප්‍රගතිය" / "முன்னேற்றம்"), and the localized
 * section heading underneath. The numeric percentage stays the same digits
 * across languages but must remain mounted as `aria-hidden` decoration.
 *
 * "Halfway" = advance through ~half of the questions before each toggle so
 * we exercise mid-survey state, not the initial render.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { I18nProvider, UI, pickText, type Lang } from "@/lib/i18n";
import { formatQuestionPosition } from "@/lib/format";
import type { Survey } from "@/surveys/types";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => {} }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
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

const TOTAL = 6;
const SECTION = { en: "Section A", si: "අංශය ඒ", ta: "பிரிவு ஏ" };
const SURVEY: Survey = {
  slug: "e2e-progress-stats-i18n",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: Array.from({ length: TOTAL }, (_, i) => ({
    id: `q${i + 1}`,
    type: "text" as const,
    section: SECTION,
    label: {
      en: `Question ${i + 1}`,
      si: `ප්‍රශ්නය ${i + 1}`,
      ta: `கேள்வி ${i + 1}`,
    },
    required: true,
  })),
};

function renderRunner(lang: Lang) {
  return render(
    <I18nProvider>
      <SurveyRunner survey={SURVEY} initialToken="tok" initialLanguage={lang} />
    </I18nProvider>,
  );
}

function position() {
  return screen.getByTestId("question-position");
}
function progressBar(): HTMLElement {
  // shadcn Progress renders role="progressbar"; aria-label comes from props.
  const el = document.querySelector('[role="progressbar"]') as HTMLElement | null;
  if (!el) throw new Error("progressbar not found");
  return el;
}
function pctChip(): HTMLElement {
  // The "{pct}%" span is the only aria-hidden sibling of QuestionPosition.
  const el = position().parentElement?.querySelector('[aria-hidden="true"]');
  if (!el) throw new Error("percent chip not found");
  return el as HTMLElement;
}
function sectionHeading(lang: Lang): HTMLElement {
  const expected = pickText(SECTION, lang);
  const el = Array.from(document.querySelectorAll("p,span,div,h1,h2,h3")).find(
    (n) => n.textContent?.trim() === expected,
  ) as HTMLElement | undefined;
  if (!el) throw new Error(`section heading "${expected}" not in DOM`);
  return el;
}
function langPill(label: string): HTMLButtonElement {
  const btn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.trim() === label,
  );
  if (!btn) throw new Error(`language pill "${label}" not found`);
  return btn;
}

function clickNext(container: HTMLElement, value: string) {
  const input = container.querySelector("input[type=text]") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  const nextBtn = container.querySelector("nav button.flex-1") as HTMLButtonElement;
  act(() => nextBtn.click());
}

function advanceHalfway(container: HTMLElement, lang: Lang) {
  const halfway = Math.floor(TOTAL / 2); // → 3 Next clicks → currently on Q4 of 6
  for (let i = 0; i < halfway; i++) {
    clickNext(container, `${lang}-${i}`);
  }
  return halfway + 1; // 1-based current index
}

async function assertStatsIn(lang: Lang, current: number, expectedPct?: string) {
  const expectedPos = formatQuestionPosition(current, TOTAL, lang);
  const expectedAria = pickText(UI.progress, lang);
  const expectedSection = pickText(SECTION, lang);

  await waitFor(() => {
    expect(position().textContent?.trim()).toBe(expectedPos);
    expect(progressBar().getAttribute("aria-label")).toBe(expectedAria);
    expect(sectionHeading(lang)).toBeTruthy();
    void expectedSection;
    // Percent chip is decorative (aria-hidden) — must remain hidden, and
    // when a baseline is provided its digits must not change just because
    // we switched languages (toggling locale never changes progress math).
    expect(pctChip().getAttribute("aria-hidden")).toBe("true");
    if (expectedPct !== undefined) {
      expect(pctChip().textContent?.trim()).toBe(expectedPct);
    }
  });
}

describe("SurveyRunner — mid-survey language toggle relocalizes progress statistics", () => {
  it("EN → SI → TA → EN halfway through: every progress-stat string flips immediately", async () => {
    const { container } = renderRunner("en");

    const current = advanceHalfway(container, "en");
    await assertStatsIn("en", current);
    // Snapshot the percent chip after the halfway advance — it must remain
    // identical across every subsequent language toggle.
    const baselinePct = pctChip().textContent?.trim() ?? "";
    expect(baselinePct).toMatch(/^\d+%$/);

    // Sanity: the three localized position strings are genuinely distinct
    // (so later assertions are not silently matching the EN fallback).
    const variants = (["en", "si", "ta"] as const).map((l) =>
      formatQuestionPosition(current, TOTAL, l),
    );
    expect(new Set(variants).size).toBe(3);

    // EN → SI: stats relocalize without losing position or changing pct.
    act(() => fireEvent.click(langPill("සි")));
    await waitFor(() =>
      expect(langPill("සි").getAttribute("aria-pressed")).toBe("true"),
    );
    await assertStatsIn("si", current, baselinePct);

    // SI → TA.
    act(() => fireEvent.click(langPill("த")));
    await waitFor(() =>
      expect(langPill("த").getAttribute("aria-pressed")).toBe("true"),
    );
    await assertStatsIn("ta", current, baselinePct);

    // TA → EN round-trip.
    act(() => fireEvent.click(langPill("EN")));
    await waitFor(() =>
      expect(langPill("EN").getAttribute("aria-pressed")).toBe("true"),
    );
    await assertStatsIn("en", current, baselinePct);
  });

  it("a Next click after toggling carries forward in the new locale", async () => {
    const { container } = renderRunner("en");
    const afterHalf = advanceHalfway(container, "en");
    await assertStatsIn("en", afterHalf);
    const baselinePct = pctChip().textContent?.trim() ?? "";

    act(() => fireEvent.click(langPill("த")));
    await assertStatsIn("ta", afterHalf, baselinePct);

    clickNext(container, "post-toggle");
    // After another Next, position must advance and stay in Tamil.
    await assertStatsIn("ta", afterHalf + 1);
  });
});
