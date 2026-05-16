import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { QuestionCount, QuestionPosition } from "@/components/QuestionCount";

function setup() {
  return render(
    <I18nProvider>
      <LanguageToggle />
      <QuestionCount count={39} />
      <QuestionPosition current={3} total={39} announce />
    </I18nProvider>,
  );
}

describe("QuestionCount/QuestionPosition reactivity to LanguageToggle", () => {
  it("re-renders both widgets in the new language with no remount and no reload", () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });

    setup();

    const countBefore = screen.getByTestId("question-count");
    const posBefore = screen.getByTestId("question-position");

    // EN baseline
    expect(countBefore.textContent).toBe("39 questions");
    expect(countBefore.getAttribute("data-lang")).toBe("en");
    expect(posBefore.textContent).toBe("Question 3 of 39");
    expect(posBefore.getAttribute("data-lang")).toBe("en");

    // → SI
    fireEvent.click(screen.getByRole("button", { name: "සි" }));
    const countSi = screen.getByTestId("question-count");
    const posSi = screen.getByTestId("question-position");
    // Same DOM node — reactive update, not remount
    expect(countSi).toBe(countBefore);
    expect(posSi).toBe(posBefore);
    expect(countSi.textContent).toBe("ප්‍රශ්න 39");
    expect(countSi.getAttribute("data-lang")).toBe("si");
    expect(posSi.textContent).toBe("ප්‍රශ්න 3 / 39");
    expect(posSi.getAttribute("data-lang")).toBe("si");

    // → TA
    fireEvent.click(screen.getByRole("button", { name: "த" }));
    expect(screen.getByTestId("question-count").textContent).toBe("கேள்விகள் 39");
    expect(screen.getByTestId("question-count").getAttribute("data-lang")).toBe("ta");
    expect(screen.getByTestId("question-position").textContent).toBe("கேள்விகள் 3 / 39");
    expect(screen.getByTestId("question-position").getAttribute("data-lang")).toBe("ta");

    // → EN (revert)
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(screen.getByTestId("question-count").textContent).toBe("39 questions");
    expect(screen.getByTestId("question-position").textContent).toBe("Question 3 of 39");

    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
