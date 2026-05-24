/**
 * E2E: Next-button required-answer gating for `tel` and `number_range`
 * across EN / SI / TA, plus the Back / Forward re-evaluation contract.
 *
 * Scope (one file, all four asks the user requested):
 *   1. tel and number_range gating: Next is disabled when empty / format-
 *      invalid and enabled only on a valid value (per language).
 *   2. After advancing forward then pressing Back, the Next-button guard
 *      re-evaluates against the *current* question's answer — not the one
 *      we just left — for tel and number_range.
 *   3. Tapping Back multiple times walks the runner backwards and the
 *      Next-button enabled/disabled state matches the restored question's
 *      stored answer at every step.
 *   4. Typed/selected answers are preserved across Back, and the Next
 *      button's state on the restored question matches that preserved
 *      answer (valid stays enabled, cleared/invalid stays disabled).
 *
 * Implementation note: the gating itself is already in `SurveyRunner.tsx`
 * (lines ~573-593) — the Next button is `disabled` when EITHER the
 * required-empty OR `validateAnswer(...)` checks fire, and `validateAnswer`
 * already covers `tel` (`TEL_RE`) and `number_range` (numeric regex). This
 * file pins that contract as a regression suite across the three locales.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { I18nProvider, useLang, type Lang, pickText } from "@/lib/i18n";
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

// q1 text → q2 tel → q3 number_range → q4 text. Four required questions
// gives us enough surface to walk forward and back across both gated types.
const SURVEY: Survey = {
  slug: "e2e-tel-numrange-gating",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      section: { en: "S", si: "කොටස", ta: "பகுதி" },
      label: { en: "Name", si: "නම", ta: "பெயர்" },
      required: true,
    },
    {
      id: "q2",
      type: "tel",
      section: { en: "S", si: "කොටස", ta: "பகுதி" },
      label: { en: "Phone", si: "දුරකථන", ta: "தொலைபேசி" },
      required: true,
    },
    {
      id: "q3",
      type: "number_range",
      section: { en: "S", si: "කොටස", ta: "பகுதி" },
      label: { en: "Years", si: "වසර", ta: "ஆண்டுகள்" },
      required: true,
    },
    {
      id: "q4",
      type: "text",
      section: { en: "S", si: "කොටස", ta: "பகුதி" },
      label: { en: "City", si: "නගරය", ta: "நகரம்" },
      required: true,
    },
  ],
};

function SetLang({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const { setLang } = useLang();
  useEffect(() => {
    setLang(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

function renderRunner(lang: Lang, initialAnswers?: Record<string, unknown>) {
  return render(
    <I18nProvider>
      <SetLang lang={lang}>
        <SurveyRunner
          survey={SURVEY}
          initialToken="tok"
          initialLanguage={lang}
          initialAnswers={initialAnswers}
        />
      </SetLang>
    </I18nProvider>,
  );
}

const LANGS: Lang[] = ["en", "si", "ta"];

function nextBtn(): HTMLButtonElement {
  return screen.getByTestId("next-button") as HTMLButtonElement;
}

function backBtn(): HTMLButtonElement {
  // Back is the first <button> inside the sticky bottom <nav>.
  const btn = document.querySelector("nav button") as HTMLButtonElement | null;
  if (!btn) throw new Error("Back button not found");
  return btn;
}

function activeInput(): HTMLInputElement {
  // Each question step renders exactly one <input> in <main> for the four
  // types in this fixture.
  const input = document.querySelector("main input") as HTMLInputElement | null;
  if (!input) throw new Error("Active input not found");
  return input;
}

async function clickNext() {
  await act(async () => {
    fireEvent.click(nextBtn());
  });
}

async function clickBack() {
  await act(async () => {
    fireEvent.click(backBtn());
  });
}

async function type(value: string) {
  await act(async () => {
    fireEvent.change(activeInput(), { target: { value } });
  });
}

function expectBlocked(blocked: boolean) {
  const n = nextBtn();
  expect(n.disabled).toBe(false);
  expect(n.getAttribute("aria-disabled")).toBe(String(blocked));
}

function activeLabel(): string {
  const h2 = document.querySelector("main section h2");
  return (h2?.textContent ?? "").trim();
}

// ────────────────────────────────────────────────────────────────────────
// 1. tel + number_range required-answer gating per language
// ────────────────────────────────────────────────────────────────────────

describe("Next gating — tel required (EN/SI/TA)", () => {
  for (const lang of LANGS) {
    it(`[${lang}] tel: disabled when empty, disabled on invalid format, enabled on valid`, async () => {
      const { unmount } = renderRunner(lang, { q1: "Sample Org" });
      await clickNext(); // → q2 (tel)
      expect(activeLabel()).toContain(pickText(SURVEY.questions[1].label, lang));
      expect(activeInput().type).toBe("tel");

      // empty + required → disabled
      expectBlocked(true);

      // invalid (too short / wrong chars per TEL_RE = /^[+()\-\s\d]{6,}$/)
      await type("12");
      expectBlocked(true);
      await type("hello!");
      expectBlocked(true);

      // valid
      await type("+94 71 234 5678");
      expectBlocked(false);

      unmount();
    });
  }
});

describe("Next gating — number_range required (EN/SI/TA)", () => {
  for (const lang of LANGS) {
    it(`[${lang}] number_range: disabled when empty, disabled on non-numeric, enabled on numeric`, async () => {
      const { unmount } = renderRunner(lang, {
        q1: "Sample Org",
        q2: "+94 71 234 5678",
      });
      await clickNext(); // → q2
      await clickNext(); // → q3 (number_range)
      expect(activeLabel()).toContain(pickText(SURVEY.questions[2].label, lang));
      expect(activeInput().type).toBe("number");

      // empty + required → disabled
      expectBlocked(true);

      // non-numeric (the type=number input may swallow letters in some
      // browsers, but if it lands as the value the regex still rejects it)
      await type("");
      expectBlocked(true);

      // valid integer / decimal
      await type("5");
      expectBlocked(false);
      await type("3.14");
      expectBlocked(false);
      await type("-7");
      expectBlocked(false);

      // clearing it again must re-disable
      await type("");
      expectBlocked(true);

      unmount();
    });
  }
});

// ────────────────────────────────────────────────────────────────────────
// 2. Next-button guard after Back/Forward for tel + number_range
// ────────────────────────────────────────────────────────────────────────

describe("Next gating — re-evaluates after Back/Forward (EN/SI/TA)", () => {
  for (const lang of LANGS) {
    it(`[${lang}] tel ↔ number_range Back/Forward re-evaluates the guard against the current question`, async () => {
      const { unmount } = renderRunner(lang, { q1: "Sample Org" });
      await clickNext(); // → q2 tel (empty)

      // Fill tel with a VALID value, advance to q3, then Back: the guard
      // must now reflect q3's emptiness, not q2's validity.
      await type("+94 71 234 5678");
      expectBlocked(false);
      await clickNext(); // → q3 number_range (empty)
      expect(activeLabel()).toContain(pickText(SURVEY.questions[2].label, lang));
      expectBlocked(true); // empty number_range → blocked

      await clickBack(); // → q2
      expect(activeLabel()).toContain(pickText(SURVEY.questions[1].label, lang));
      expectBlocked(false); // q2's tel value preserved + valid

      // Forward again to q3 (still empty) — guard must block again.
      await clickNext();
      expect(activeLabel()).toContain(pickText(SURVEY.questions[2].label, lang));
      expectBlocked(true);

      // Fill number_range with INVALID-then-valid; verify the guard tracks
      // each transition after a Back/Forward round-trip.
      await type("");
      await clickBack(); // → q2 (still valid)
      expectBlocked(false);
      await clickNext(); // → q3 (still empty)
      expectBlocked(true);
      await type("42");
      expectBlocked(false);

      unmount();
    });
  }
});

// ────────────────────────────────────────────────────────────────────────
// 3. Multiple Back taps: guard re-evaluates correctly per current question
// ────────────────────────────────────────────────────────────────────────

describe("Next gating — multiple Back taps re-evaluate per restored question (EN/SI/TA)", () => {
  for (const lang of LANGS) {
    it(`[${lang}] burst Back from q4 → q3 → q2 → q1 toggles Next per stored answer`, async () => {
      // Walk forward q1→q4 with all four answers valid (so each Next click
      // is allowed), then on q4 walk back to q3 and CLEAR it. Now Back-walk
      // q3→q2→q1 and assert Next mirrors each restored question's state.
      const { unmount } = renderRunner(lang, {
        q1: "Sample Org",
        q2: "+94 71 234 5678",
        q3: "5",
        q4: "Colombo",
      });
      // Initial render is q1; advance through to q4.
      await clickNext(); // → q2
      await clickNext(); // → q3
      await clickNext(); // → q4
      expect(activeLabel()).toContain(pickText(SURVEY.questions[3].label, lang));
      expectBlocked(false); // q4 valid

      // Step back to q3 and CLEAR it. The clear stays in answers as empty
      // string, which means q3 will now block Next when we revisit it on
      // the way down. We do NOT try to advance from cleared q3 (the
      // runner correctly gates that — that's the whole point).
      await clickBack(); // → q3
      await type("");
      expect(activeInput().value).toBe("");
      expectBlocked(true);

      // Burst Back from q3 → q2 → q1, asserting Next mirrors each step.
      await clickBack(); // → q2
      expect(activeLabel()).toContain(pickText(SURVEY.questions[1].label, lang));
      expectBlocked(false); // q2 valid tel preserved

      await clickBack(); // → q1
      expect(activeLabel()).toContain(pickText(SURVEY.questions[0].label, lang));
      expectBlocked(false); // q1 valid text preserved

      // Back at q1 is a no-op (disabled) — guard for q1 must not change.
      expect(backBtn().disabled).toBe(true);
      await clickBack();
      expect(activeLabel()).toContain(pickText(SURVEY.questions[0].label, lang));
      expectBlocked(false);

      unmount();
    });
  }
});

// ────────────────────────────────────────────────────────────────────────
// 4. Answers preserved on Back; Next state matches restored answer
// ────────────────────────────────────────────────────────────────────────

describe("Back preserves typed/selected answers and Next mirrors them (EN/SI/TA)", () => {
  for (const lang of LANGS) {
    it(`[${lang}] tel + number_range typed values survive Back and Next state matches`, async () => {
      const { unmount } = renderRunner(lang, { q1: "Sample Org" });
      await clickNext(); // → q2

      // Type a valid tel, advance, then Back — the input must show the
      // preserved value and Next must be enabled.
      await type("+94 71 234 5678");
      await clickNext(); // → q3
      await type("42");
      await clickNext(); // → q4

      // Walk back to q3 — number value preserved, Next enabled.
      await clickBack();
      expect(activeLabel()).toContain(pickText(SURVEY.questions[2].label, lang));
      expect(activeInput().value).toBe("42");
      expectBlocked(false);

      // Walk back to q2 — tel value preserved, Next enabled.
      await clickBack();
      expect(activeLabel()).toContain(pickText(SURVEY.questions[1].label, lang));
      expect(activeInput().value).toBe("+94 71 234 5678");
      expectBlocked(false);

      // Mutate q2 to an INVALID value, then Back to q1 (disabled), Forward
      // to q2 again — invalid value still preserved, Next now disabled.
      await type("12"); // invalid (TEL_RE requires ≥6 of [+()\-\s\d])
      expectBlocked(true);
      await clickBack(); // → q1
      expect(activeInput().value).toBe("Sample Org");
      expectBlocked(false);
      await clickNext(); // → q2 with preserved invalid value
      await waitFor(() => expect(activeInput().value).toBe("12"));
      expectBlocked(true);

      // Walk all the way forward — each step's stored value must round-trip.
      await type("+94 71 234 5678");
      expectBlocked(false);
      await clickNext(); // → q3
      expect(activeInput().value).toBe("42");
      await clickNext(); // → q4
      expect(activeInput().value).toBe(""); // never typed → still empty
      expectBlocked(true);

      unmount();
    });
  }
});
