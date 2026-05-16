/**
 * Mid-question language toggle: the inline validation message (role="alert")
 * AND every piece of question text (section, label, help, free-text
 * placeholder) must re-render in the newly selected language on the very
 * next render — no stale strings sticking to the screen.
 *
 * Drives `QuestionView` directly with the same error-string contract the
 * runner uses (`formatValidationError(code, lang)` from validation.ts), so a
 * regression in either the error pipeline or the localized-text resolution
 * surfaces here.
 */
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { I18nProvider, useLang, type Lang, pickText, UI } from "@/lib/i18n";
import {
  formatValidationError,
  validateAnswerCode,
  type ValidationError,
} from "@/components/survey/validation";
import type { Question } from "@/surveys/types";

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

import { QuestionView } from "@/components/survey/QuestionView";

const EMAIL_Q: Question = {
  id: "q-email",
  type: "email",
  required: true,
  section: { en: "Contact", si: "සම්බන්ධතා", ta: "தொடர்பு" },
  label: { en: "Your email", si: "ඔබේ ඊමේල්", ta: "உங்கள் மின்னஞ்சல்" },
  help: { en: "We will reply here", si: "අපි මෙහි පිළිතුරු දෙමු", ta: "நாங்கள் இங்கே பதிலளிப்போம்" },
};

const MULTI_Q: Question = {
  id: "q-multi",
  type: "multi_choice",
  required: true,
  minSelect: 2,
  section: { en: "Picks", si: "තේරීම්", ta: "தேர்வுகள்" },
  label: { en: "Pick two", si: "දෙකක් තෝරන්න", ta: "இரண்டை தேர்வு" },
  options: [
    { value: "a", label: { en: "A", si: "අ", ta: "அ" } },
    { value: "b", label: { en: "B", si: "ආ", ta: "ஆ" } },
    { value: "c", label: { en: "C", si: "ඇ", ta: "இ" } },
  ],
};

/** Harness: holds a question + current value, derives the error in the
 *  active language on every render, and exposes a hook to flip language
 *  mid-question without unmounting `QuestionView`. */
function Harness({ q, value }: { q: Question; value: unknown }) {
  const { lang, setLang } = useLang();
  const [v] = useState<unknown>(value);
  const code: ValidationError | null = validateAnswerCode(q, v);
  // Mirror the runner's required-empty pathway too (same UI.required string).
  const isEmpty = v == null || (typeof v === "string" && v.trim() === "") ||
    (Array.isArray(v) && v.length === 0);
  const error = code
    ? formatValidationError(code, lang)
    : q.required && isEmpty
      ? pickText(UI.required, lang)
      : null;
  return (
    <>
      <button data-testid="to-en" onClick={() => setLang("en")} />
      <button data-testid="to-si" onClick={() => setLang("si")} />
      <button data-testid="to-ta" onClick={() => setLang("ta")} />
      <QuestionView q={q} value={v} onChange={() => {}} error={error} />
    </>
  );
}

function clickLang(lang: Lang) {
  act(() => {
    (document.querySelector(`[data-testid="to-${lang}"]`) as HTMLButtonElement).click();
  });
}

beforeEach(() => {
  // Each test starts in EN — i18n persists choice in localStorage between
  // renders, which would otherwise leak the previous test's language.
  window.localStorage.clear();
});

// Returns the error message paragraph inside the banner (the second
// <p> inside the alert region — the first is the localized "Please fix
// this to continue" title). Asserting against this narrower target
// keeps the existing checks meaningful regardless of any future
// banner-title copy changes.
function alertMessage(): string {
  const alert = screen.getByRole("alert");
  const ps = alert.querySelectorAll("p");
  return ps[ps.length - 1]?.textContent ?? "";
}

describe("QuestionView — mid-question language toggle", () => {
  it("re-renders the invalid-email alert AND question text in the new language on toggle", () => {
    render(
      <I18nProvider>
        <Harness q={EMAIL_Q} value="not-an-email" />
      </I18nProvider>,
    );

    // Initial EN snapshot.
    expect(alertMessage()).toBe(pickText(UI.invalidEmail, "en"));
    expect(screen.getByText("Contact")).toBeInTheDocument();
    expect(screen.getByText("Your email")).toBeInTheDocument();
    expect(screen.getByText("We will reply here")).toBeInTheDocument();
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
    expect(emailInput.placeholder).toBe(pickText(UI.placeholderEmail, "en"));

    // EN → SI: alert + section + label + help + placeholder all flip.
    clickLang("si");
    expect(alertMessage()).toBe(pickText(UI.invalidEmail, "si"));
    expect(screen.getByText("සම්බන්ධතා")).toBeInTheDocument();
    expect(screen.getByText("ඔබේ ඊමේල්")).toBeInTheDocument();
    expect(screen.getByText("අපි මෙහි පිළිතුරු දෙමු")).toBeInTheDocument();
    expect(emailInput.placeholder).toBe(pickText(UI.placeholderEmail, "si"));
    expect(screen.queryByText("Contact")).toBeNull();
    expect(screen.queryByText("Your email")).toBeNull();

    // SI → TA: same flip, this time in Tamil.
    clickLang("ta");
    expect(alertMessage()).toBe(pickText(UI.invalidEmail, "ta"));
    expect(screen.getByText("தொடர்பு")).toBeInTheDocument();
    expect(screen.getByText("உங்கள் மின்னஞ்சல்")).toBeInTheDocument();
    expect(screen.getByText("நாங்கள் இங்கே பதிலளிப்போம்")).toBeInTheDocument();
    expect(emailInput.placeholder).toBe(pickText(UI.placeholderEmail, "ta"));

    // Round-trip back to EN — nothing leaks.
    clickLang("en");
    expect(alertMessage()).toBe(pickText(UI.invalidEmail, "en"));
    expect(screen.getByText("Your email")).toBeInTheDocument();

    // Sanity: the three localized error messages are genuinely different.
    const errs = (["en", "si", "ta"] as const).map((l) =>
      formatValidationError({ code: "invalidEmail" }, l),
    );
    expect(new Set(errs).size).toBe(3);
  });

  it("re-renders the selectAtLeast {n} alert in the active language on toggle", () => {
    render(
      <I18nProvider>
        <Harness q={MULTI_Q} value={["a"]} />
      </I18nProvider>,
    );

    const expected = (lang: Lang) =>
      pickText(UI.selectAtLeast, lang).replace("{n}", "2");

    expect(alertMessage()).toBe(expected("en"));
    clickLang("si");
    expect(alertMessage()).toBe(expected("si"));
    expect(screen.getByText("තේරීම්")).toBeInTheDocument();
    expect(screen.getByText("දෙකක් තෝරන්න")).toBeInTheDocument();
    clickLang("ta");
    expect(alertMessage()).toBe(expected("ta"));
    expect(screen.getByText("தேர்வுகள்")).toBeInTheDocument();
    expect(screen.getByText("இரண்டை தேர்வு")).toBeInTheDocument();

    // The three placeholders/messages are genuinely different per language.
    const set = new Set((["en", "si", "ta"] as const).map(expected));
    expect(set.size).toBe(3);
  });

  it("re-renders the generic Required message in the active language on toggle", () => {
    // Required + empty → mirrors goNext's `setValidationErrorCode('required')` path.
    render(
      <I18nProvider>
        <Harness q={EMAIL_Q} value="" />
      </I18nProvider>,
    );
    expect(alertMessage()).toBe(pickText(UI.required, "en"));
    clickLang("si");
    expect(alertMessage()).toBe(pickText(UI.required, "si"));
    clickLang("ta");
    expect(alertMessage()).toBe(pickText(UI.required, "ta"));
  });
});