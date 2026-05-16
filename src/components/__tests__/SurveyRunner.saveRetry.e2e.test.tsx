/**
 * E2E scenario: when the Supabase-backed `saveAnswers` server fn fails on the
 * first attempt, the user's typed answer must remain in the input and the
 * Save (a.k.a. "Save & exit") button must return to a clickable retry state.
 * Tapping it again invokes `saveAnswers` a second time with the SAME payload
 * and surfaces the success toast — proving no answer data was dropped.
 */
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";
import { I18nProvider, UI, pickText } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

// ── Mocks ─────────────────────────────────────────────────────────
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

// One-shot failing save: rejects on call #1, resolves on call #2+.
const saveAnswers = vi.fn();
const startResponse = vi.fn().mockResolvedValue({ resumeToken: "tok" });
const completeResponse = vi.fn().mockResolvedValue({});
vi.mock("@/lib/responses.functions", () => ({
  startResponse: (...args: unknown[]) => startResponse(...args),
  saveAnswers: (...args: unknown[]) => saveAnswers(...args),
  completeResponse: (...args: unknown[]) => completeResponse(...args),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(() => {}, {
    success: (msg: string) => toastSuccess(msg),
    error: (msg: string) => toastError(msg),
  }),
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

const SURVEY: Survey = {
  slug: "save-retry",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Your name", si: "නම", ta: "பெயர்" },
      required: false,
    },
  ],
};

const ANSWER = "Persisted answer text";

function renderRunner() {
  return render(
    <I18nProvider>
      <SurveyRunner
        survey={SURVEY}
        initialLanguage="en"
        initialToken="tok"
      />
    </I18nProvider>,
  );
}

function getInput(): HTMLInputElement {
  const el = document.querySelector('input[type="text"]') as HTMLInputElement | null;
  if (!el) throw new Error("text question input not found");
  return el;
}

function getSaveButton(): HTMLButtonElement {
  const label = pickText(UI.saveExit, "en");
  const btn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.getAttribute("aria-label") === label,
  );
  if (!btn) throw new Error("Save & exit button not found");
  return btn;
}

describe("SurveyRunner — save failure retry e2e", () => {
  it("preserves the user's answer and surfaces a retry state when saveAnswers fails once", async () => {
    saveAnswers.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();

    // Fail once, then succeed on retry.
    saveAnswers
      .mockRejectedValueOnce(new Error("Network down"))
      .mockResolvedValueOnce({});

    renderRunner();

    // Type an answer.
    const input = getInput();
    act(() => {
      fireEvent.change(input, { target: { value: ANSWER } });
    });
    expect(getInput().value).toBe(ANSWER);

    // First save attempt → server fn rejects.
    const saveBtn = getSaveButton();
    expect(saveBtn.disabled).toBe(false);
    await act(async () => {
      saveBtn.click();
    });

    // Error toast appears with the localized errorSave string.
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(pickText(UI.errorSave, "en"));
    });
    expect(toastSuccess).not.toHaveBeenCalled();

    // Retry state: button is re-enabled (busy=false) and answer is still in
    // the input — no data lost.
    await waitFor(() => {
      expect(getSaveButton().disabled).toBe(false);
    });
    expect(getInput().value).toBe(ANSWER);

    // saveAnswers received the typed answer on the failed attempt.
    expect(saveAnswers).toHaveBeenCalledTimes(1);
    const firstCallPayload = saveAnswers.mock.calls[0][0];
    expect(firstCallPayload).toMatchObject({
      data: {
        resumeToken: "tok",
        answers: { q1: ANSWER },
      },
    });

    // Second tap on Save → succeeds, success toast fires, same payload.
    await act(async () => {
      getSaveButton().click();
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(pickText(UI.saved, "en"));
    });
    expect(saveAnswers).toHaveBeenCalledTimes(2);
    const secondCallPayload = saveAnswers.mock.calls[1][0];
    expect(secondCallPayload).toMatchObject({
      data: {
        resumeToken: "tok",
        answers: { q1: ANSWER },
      },
    });

    // Final state: answer survived both round trips.
    expect(getInput().value).toBe(ANSWER);
  });
});
