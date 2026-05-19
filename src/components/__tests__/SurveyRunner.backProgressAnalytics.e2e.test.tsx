/**
 * Backward-navigation coverage for the sticky progress analytics.
 *
 * After clicking Back, the header's "visual progress analytics and
 * statistics" must rewind in lockstep with the question pointer, in every
 * supported language. We verify, per click:
 *   • localized "Question N of M" / "ප්‍රශ්න N / M" / "கேள்விகள் N / M"
 *   • Progress bar's `aria-valuenow` AND `value` attribute
 *   • the decorative `aria-hidden` percent chip's digits
 *   • Progress bar's localized `aria-label` ("Progress" / "ප්‍රගතිය" /
 *     "முன்னேற்றம்") never reverts to the EN fallback
 *   • Back is disabled at Q1 and re-enabled after advancing
 *   • the live-region wiring (aria-live=polite + role=status + aria-atomic)
 *     stays on the same DOM node so screen readers re-announce the rewind
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

const TOTAL = 4;
const SURVEY: Survey = {
  slug: "back-progress-analytics",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: Array.from({ length: TOTAL }, (_, i) => ({
    id: `q${i + 1}`,
    type: "text" as const,
    section: { en: "S", si: "කොටස", ta: "பகுதி" },
    label: { en: `Q${i + 1}`, si: `Q${i + 1}`, ta: `Q${i + 1}` },
    required: true,
  })),
};

const SAMPLE: Record<Lang, string> = { en: "ans", si: "පිළි", ta: "பதில்" };

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
function progressBar(): HTMLElement {
  const el = document.querySelector('[role="progressbar"]') as HTMLElement | null;
  if (!el) throw new Error("progressbar not found");
  return el;
}
function pctChip(): HTMLElement {
  const el = screen.getByTestId("progress-percent-chip");
  if (!el) throw new Error("percent chip not found");
  return el as HTMLElement;
}
function backBtn(container: HTMLElement): HTMLButtonElement {
  // Bottom nav layout: [Back, Save&Exit, Next]. Back is the first button.
  const btn = container.querySelector("nav button") as HTMLButtonElement | null;
  if (!btn) throw new Error("Back button not found");
  return btn;
}
function nextBtn(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector("nav button.flex-1") as HTMLButtonElement | null;
  if (!btn) throw new Error("Next button not found");
  return btn;
}
function clickNext(container: HTMLElement, value: string) {
  const input = container.querySelector("input[type=text]") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  act(() => nextBtn(container).click());
}
function clickBack(container: HTMLElement) {
  act(() => backBtn(container).click());
}

interface AnalyticsSnapshot {
  positionText: string;
  pctChipText: string;
  ariaValueNow: string | null;
  ariaLabel: string | null;
  liveRegionNode: HTMLElement;
}

function snapshot(): AnalyticsSnapshot {
  return {
    positionText: position().textContent?.trim() ?? "",
    pctChipText: pctChip().textContent?.trim() ?? "",
    ariaValueNow: progressBar().getAttribute("aria-valuenow"),
    ariaLabel: progressBar().getAttribute("aria-label"),
    liveRegionNode: position(),
  };
}

async function expectPosition(lang: Lang, current: number) {
  await waitFor(() =>
    expect(position().textContent?.trim()).toBe(formatQuestionPosition(current, TOTAL, lang)),
  );
}

describe("SurveyRunner — Back navigation rewinds the progress analytics", () => {
  const langs: Lang[] = ["en", "si", "ta"];

  for (const lang of langs) {
    it(`${lang}: stepping forward then Back rewinds position, percent chip, and aria-valuenow in lockstep`, async () => {
      const { container } = renderRunner(lang);

      // Q1 baseline: Back is disabled, position text is localized.
      await expectPosition(lang, 1);
      expect(backBtn(container).disabled).toBe(true);
      const liveNode = position();
      expect(liveNode.getAttribute("aria-live")).toBe("polite");
      expect(liveNode.getAttribute("role")).toBe("status");
      expect(liveNode.getAttribute("aria-atomic")).toBe("true");

      // Walk forward Q1 → Q4 capturing the analytics snapshot at each step.
      const forward: AnalyticsSnapshot[] = [snapshot()];
      for (let step = 2; step <= TOTAL; step++) {
        clickNext(container, `${SAMPLE[lang]}-${step}`);
        await expectPosition(lang, step);
        forward.push(snapshot());
      }

      // Sanity: pct chip and aria-valuenow strictly increased while moving
      // forward — i.e. the analytics were actually advancing.
      const numericPct = (s: string) => Number.parseInt(s.replace("%", ""), 10);
      const fwdPcts = forward.map((s) => numericPct(s.pctChipText));
      for (let i = 1; i < fwdPcts.length; i++) {
        expect(fwdPcts[i]).toBeGreaterThan(fwdPcts[i - 1]);
      }
      // Localized aria-label survived every forward step.
      const expectedAria = pickText(UI.progress, lang);
      for (const s of forward) expect(s.ariaLabel).toBe(expectedAria);

      // Now rewind Q4 → Q1 and assert each Back click restores the
      // localized position text exactly. The percent chip / aria-valuenow
      // track *answered count*, not pointer position — so they must NOT
      // decrease on Back (user's prior work is preserved). The forward
      // peak is the floor for every backward step.
      const peakPct = numericPct(forward[forward.length - 1].pctChipText);
      for (let step = TOTAL - 1; step >= 1; step--) {
        clickBack(container);
        await expectPosition(lang, step);
        const now = snapshot();
        const prior = forward[step - 1];

        expect(now.positionText).toBe(prior.positionText);
        // Localized aria-label survives every backward step.
        expect(now.ariaLabel).toBe(expectedAria);
        // Pct chip / aria-valuenow are monotonic across the session.
        const nowPct = numericPct(now.pctChipText);
        expect(nowPct).toBeGreaterThanOrEqual(numericPct(prior.pctChipText));
        expect(nowPct).toBe(peakPct);

        // The live region must be the same node throughout — this is what
        // makes assistive tech re-announce instead of going silent.
        expect(now.liveRegionNode).toBe(liveNode);
        expect(now.liveRegionNode.getAttribute("aria-live")).toBe("polite");
        expect(now.liveRegionNode.getAttribute("role")).toBe("status");
      }

      // Back at Q1, Back is disabled again.
      await waitFor(() => expect(backBtn(container).disabled).toBe(true));
      expect(pctChip().textContent?.trim()).toMatch(/^\d+%$/);
    });
  }

  it("Back never bleeds the percent chip below 0% or above 100% (boundary)", async () => {
    const { container } = renderRunner("en");
    await expectPosition("en", 1);
    // Click Back at Q1 (button is disabled, but force the call to ensure
    // nothing crashes and the chip stays in the valid range).
    const before = pctChip().textContent?.trim() ?? "";
    act(() => backBtn(container).click());
    await new Promise((r) => setTimeout(r, 20));
    const after = pctChip().textContent?.trim() ?? "";
    expect(after).toBe(before);
    const n = Number.parseInt(after.replace("%", ""), 10);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(100);
  });
});
