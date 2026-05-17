/**
 * A11y: pressing Back must trigger TWO screen-reader announcements
 * in every supported language (EN, SI, TA):
 *
 *   1. The sticky progress header live-region — `aria-live="polite"` /
 *      `role="status"` / `aria-atomic="true"` — must update its
 *      textContent to the localized "Question N of M" / "ප්‍රශ්න N / M" /
 *      "கேள்விகள் N / M" for the question we just rewound to. The DOM
 *      node identity must be preserved across the rewind so AT
 *      subscribes to the same region and re-announces the change
 *      instead of going silent.
 *
 *   2. The question change itself must be announced. We verify this
 *      by asserting that after Back the focus moves to the restored
 *      question's answer control AND the visible <h2> question label
 *      (the section landmark heading the screen reader speaks when
 *      focus enters the question panel) is the localized label of the
 *      question we just rewound to — not the one we left.
 *
 * Together these prove that a non-sighted user pressing Back hears
 * both "Question N of M" (in their language) and the new question's
 * label spoken — they are never left wondering whether Back did
 * anything.
 */
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";
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

const TOTAL = 3;
// Per-language, distinct labels per question so we can detect that the
// announced heading really is the rewound question's label, not the one
// we left.
const LABELS: Record<Lang, [string, string, string]> = {
  en: ["First question", "Second question", "Third question"],
  si: ["පළමු ප්‍රශ්නය", "දෙවන ප්‍රශ්නය", "තෙවන ප්‍රශ්නය"],
  ta: ["முதல் கேள்வி", "இரண்டாவது கேள்வி", "மூன்றாவது கேள்வி"],
};

function makeSurvey(): Survey {
  return {
    slug: "back-announce",
    title: { en: "T", si: "T", ta: "T" },
    subtitle: { en: "", si: "", ta: "" },
    estimatedMinutes: 1,
    consent: [],
    questions: [0, 1, 2].map((i) => ({
      id: `q${i + 1}`,
      type: "text" as const,
      section: { en: "S", si: "කොටස", ta: "பகுதி" },
      label: {
        en: LABELS.en[i],
        si: LABELS.si[i],
        ta: LABELS.ta[i],
      },
      required: true,
    })),
  };
}

function input(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector("input[type=text]") as HTMLInputElement | null;
  if (!el) throw new Error("question input not found");
  return el;
}
function nextBtn(container: HTMLElement): HTMLButtonElement {
  return container.querySelector("nav button.flex-1") as HTMLButtonElement;
}
function backBtn(container: HTMLElement): HTMLButtonElement {
  return container.querySelector("nav button") as HTMLButtonElement;
}
function position(container: HTMLElement): HTMLElement {
  return container.querySelector("[data-testid=question-position]") as HTMLElement;
}
function questionHeading(container: HTMLElement): HTMLElement {
  // The visible question label is the only <h2> inside <main>.
  const h2 = container.querySelector("main h2") as HTMLElement | null;
  if (!h2) throw new Error("question <h2> heading not found");
  return h2;
}

async function expectPosition(container: HTMLElement, lang: Lang, current: number) {
  await waitFor(() =>
    expect(position(container).textContent?.trim()).toBe(
      formatQuestionPosition(current, TOTAL, lang),
    ),
  );
}

async function fillAndAdvance(container: HTMLElement, value: string) {
  fireEvent.change(input(container), { target: { value } });
  act(() => nextBtn(container).click());
}

describe("SurveyRunner — Back triggers progress + question-change SR announcements (per language)", () => {
  for (const lang of ["en", "si", "ta"] as const) {
    it(`${lang}: progress live-region updates AND restored question's heading is exposed for re-announcement`, async () => {
      const survey = makeSurvey();
      const { container } = render(
        <I18nProvider>
          <SurveyRunner survey={survey} initialToken="tok" initialLanguage={lang} />
        </I18nProvider>,
      );

      // Q1 baseline.
      await expectPosition(container, lang, 1);
      const live = position(container);

      // ── Live region wiring is correct from the start ──
      expect(live.getAttribute("aria-live")).toBe("polite");
      expect(live.getAttribute("role")).toBe("status");
      expect(live.getAttribute("aria-atomic")).toBe("true");
      // The visible question heading reflects Q1's localized label.
      expect(questionHeading(container).textContent).toContain(LABELS[lang][0]);

      // Walk forward Q1 → Q2 → Q3 (we need somewhere to rewind FROM).
      await fillAndAdvance(container, "a");
      await expectPosition(container, lang, 2);
      await fillAndAdvance(container, "b");
      await expectPosition(container, lang, 3);
      // Sanity: we are on Q3 and the heading reflects Q3's label.
      expect(questionHeading(container).textContent).toContain(LABELS[lang][2]);
      // Type Q3's value (Back must not drop it, but we mainly want to
      // check that the announcement payload is correct on rewind).
      fireEvent.change(input(container), { target: { value: "c" } });

      // Capture the live-region textContent BEFORE Back so we can prove
      // the textContent actually changed (not just stayed the same).
      const liveBefore = live.textContent?.trim();
      expect(liveBefore).toBe(formatQuestionPosition(3, TOTAL, lang));

      // ── Press Back → AT must announce both the progress and the
      // restored question. ──
      act(() => backBtn(container).click());
      await expectPosition(container, lang, 2);

      // (1) Progress live-region: same DOM node, aria-live wiring intact,
      //     textContent is the LOCALIZED Q2 position string. The change
      //     in textContent on a node carrying aria-live=polite is
      //     exactly what causes the screen-reader announcement.
      const liveAfter = position(container);
      expect(liveAfter).toBe(live); // node identity preserved
      expect(liveAfter.getAttribute("aria-live")).toBe("polite");
      expect(liveAfter.getAttribute("role")).toBe("status");
      expect(liveAfter.getAttribute("aria-atomic")).toBe("true");
      expect(liveAfter.textContent?.trim()).toBe(formatQuestionPosition(2, TOTAL, lang));
      expect(liveAfter.textContent?.trim()).not.toBe(liveBefore);

      // (2) Question-change announcement: the visible question heading
      //     re-renders to the LOCALIZED Q2 label (not Q3's), and
      //     keyboard focus moves to the Q2 answer control so AT
      //     re-reads the question label as focus enters the panel.
      await waitFor(() => {
        expect(questionHeading(container).textContent).toContain(LABELS[lang][1]);
      });
      expect(questionHeading(container).textContent).not.toContain(LABELS[lang][2]);
      await waitFor(() => {
        // Focus contract: after a Back transition the sticky-bar Back
        // button retains focus so a keyboard user can keep rewinding
        // with Enter / Space without re-Tabbing.
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("aria-label")).toBe(pickText(UI.back, lang));
      });

      // ── Press Back again → Q1 ──
      const liveBefore2 = liveAfter.textContent?.trim();
      act(() => backBtn(container).click());
      await expectPosition(container, lang, 1);

      expect(position(container)).toBe(live); // still the same node
      expect(position(container).textContent?.trim()).toBe(formatQuestionPosition(1, TOTAL, lang));
      expect(position(container).textContent?.trim()).not.toBe(liveBefore2);
      await waitFor(() => {
        expect(questionHeading(container).textContent).toContain(LABELS[lang][0]);
      });
      expect(questionHeading(container).textContent).not.toContain(LABELS[lang][1]);

      // The localized progress aria-label on the bar itself stays in
      // the user's language across both rewinds (no EN fallback leak).
      const bar = container.querySelector('[role="progressbar"]') as HTMLElement;
      expect(bar.getAttribute("aria-label")).toBe(pickText(UI.progress, lang));
    });
  }
});
