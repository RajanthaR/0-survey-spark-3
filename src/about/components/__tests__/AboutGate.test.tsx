import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { AboutGate } from "@/about/components/AboutGate";
import { ABOUT_ACCESS_CODE, ABOUT_ACCESS_STORAGE_KEY } from "@/about/lib/access-code";
import { ABOUT_UI } from "@/about/copy/ui";
import { I18nProvider, pickText } from "@/lib/i18n";

function renderGate(onUnlock = () => {}) {
  return render(
    <I18nProvider initialLang="en">
      <AboutGate onUnlock={onUnlock} />
    </I18nProvider>,
  );
}

function type(code: string) {
  for (const digit of code) {
    fireEvent.click(screen.getByRole("button", { name: digit }));
  }
}

const wrongCode = (ABOUT_ACCESS_CODE === "0000" ? "1111" : "0000").slice(0, 4);

describe("AboutGate", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("shows the content summary and an on-screen keypad", () => {
    renderGate();
    expect(screen.getByText(pickText(ABOUT_UI.gateSummaryHeading, "en"))).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: pickText(ABOUT_UI.gateKeypadLabel, "en") }),
    ).toBeInTheDocument();
    for (const digit of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
      expect(screen.getByRole("button", { name: digit })).toBeInTheDocument();
    }
  });

  it("rejects a wrong code with an error and does not unlock", () => {
    const onUnlock = vi.fn();
    renderGate(onUnlock);

    type(wrongCode);

    expect(screen.getByRole("alert")).toHaveTextContent(pickText(ABOUT_UI.gateError, "en"));
    expect(onUnlock).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(ABOUT_ACCESS_STORAGE_KEY)).toBeNull();
  });

  it("unlocks and persists the session flag on the correct code", () => {
    const onUnlock = vi.fn();
    renderGate(onUnlock);

    type(ABOUT_ACCESS_CODE);

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(ABOUT_ACCESS_STORAGE_KEY)).toBe("1");
  });

  it("supports the delete key to correct an entry", () => {
    const onUnlock = vi.fn();
    renderGate(onUnlock);

    // Enter three digits, delete one, then complete with the wrong remainder.
    type(ABOUT_ACCESS_CODE.slice(0, 3));
    fireEvent.click(screen.getByRole("button", { name: pickText(ABOUT_UI.gateDeleteLabel, "en") }));
    // Only 2 digits remain — entering 2 more wrong digits must not unlock.
    type("00");
    expect(onUnlock).not.toHaveBeenCalled();
  });
});
