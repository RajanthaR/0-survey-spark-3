/**
 * Error-summary banner contract:
 *   - On Next-with-invalid-input, an alert banner appears at the top of
 *     the question card (role="alert", localized title + message).
 *   - The banner scrolls into view (verified via scrollIntoView spy).
 *   - Focus moves to the first interactive control inside the question
 *     field so the user can fix the problem immediately.
 *   - Editing the value clears the banner; re-failing brings it back
 *     and re-runs the scroll + focus pass.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { I18nProvider, pickText, UI } from "@/lib/i18n";
import type { Question } from "@/surveys/types";
import { QuestionView } from "@/components/survey/QuestionView";

const EMAIL_Q: Question = {
  id: "email",
  type: "email",
  required: true,
  section: { en: "Contact", si: "සම්බන්ධතා", ta: "தொடர்பு" },
  label: { en: "Your email", si: "ඔබේ ඊමේල්", ta: "உங்கள் மின்னஞ்சல்" },
};

function Harness({ initialError = null as string | null }: { initialError?: string | null }) {
  const [value, setValue] = useState("not-an-email");
  const [error, setError] = useState<string | null>(initialError);
  return (
    <>
      <button data-testid="set-error" onClick={() => setError(pickText(UI.invalidEmail, "en"))}>
        fail
      </button>
      <button data-testid="clear-error" onClick={() => setError(null)}>
        clear
      </button>
      <QuestionView
        q={EMAIL_Q}
        value={value}
        onChange={(v) => setValue(String(v ?? ""))}
        error={error}
      />
    </>
  );
}

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView — stub it so the focus
  // effect can call it without throwing.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("QuestionView — error summary banner", () => {
  it("does not render the banner while error is null", () => {
    render(
      <I18nProvider>
        <Harness />
      </I18nProvider>,
    );
    expect(screen.queryByTestId("error-summary")).toBeNull();
  });

  it("renders a localized banner with title + message and scrolls + focuses the field on error", () => {
    render(
      <I18nProvider>
        <Harness />
      </I18nProvider>,
    );
    act(() => {
      (screen.getByTestId("set-error") as HTMLButtonElement).click();
    });

    const banner = screen.getByTestId("error-summary");
    expect(banner.getAttribute("role")).toBe("alert");
    expect(banner.textContent).toContain(pickText(UI.errorSummaryTitle, "en"));
    expect(banner.textContent).toContain(pickText(UI.invalidEmail, "en"));

    // scrollIntoView was invoked on the banner.
    expect(Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).toHaveBeenCalled();

    // Focus moved to the email input (first focusable inside the field wrap).
    const input = document.querySelector('input[type="email"]') as HTMLInputElement;
    expect(document.activeElement).toBe(input);

    // Field wrap carries aria-invalid for AT.
    const wrap = screen.getByTestId("question-field");
    expect(wrap.getAttribute("aria-invalid")).toBe("true");
  });

  it("clearing the error hides the banner and removes aria-invalid", () => {
    render(
      <I18nProvider>
        <Harness initialError={pickText(UI.invalidEmail, "en")} />
      </I18nProvider>,
    );
    expect(screen.getByTestId("error-summary")).toBeInTheDocument();
    act(() => {
      (screen.getByTestId("clear-error") as HTMLButtonElement).click();
    });
    expect(screen.queryByTestId("error-summary")).toBeNull();
    expect(screen.getByTestId("question-field").getAttribute("aria-invalid")).toBeNull();
  });

  it("re-failing after a fix re-runs the scroll + focus pass", () => {
    render(
      <I18nProvider>
        <Harness />
      </I18nProvider>,
    );
    const spy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;

    act(() => {
      (screen.getByTestId("set-error") as HTMLButtonElement).click();
    });
    const firstCalls = spy.mock.calls.length;
    expect(firstCalls).toBeGreaterThan(0);

    act(() => {
      (screen.getByTestId("clear-error") as HTMLButtonElement).click();
    });
    act(() => {
      (screen.getByTestId("set-error") as HTMLButtonElement).click();
    });
    // Banner scrolled into view again on the second failure.
    expect(spy.mock.calls.length).toBeGreaterThan(firstCalls);
  });
});
