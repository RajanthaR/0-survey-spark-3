import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { I18nProvider, pickText, UI } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

vi.mock("@/lib/responses.functions", () => ({
  startResponse: vi.fn().mockResolvedValue({ id: "row", resumeToken: "tok" }),
  saveAnswers: vi.fn().mockResolvedValue({}),
  completeResponse: vi.fn().mockResolvedValue({}),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(() => {}, {
    success: () => {},
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
    motion: new Proxy({}, { get: (_target, key: string) => passthrough(key) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => false,
  };
});

import { SurveyRunner } from "@/components/SurveyRunner";

const SURVEY: Survey = {
  slug: "validation-policy",
  title: { en: "Validation", si: "Validation", ta: "Validation" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      section: { en: "Section", si: "Section", ta: "Section" },
      label: { en: "Required answer", si: "Required answer", ta: "Required answer" },
      required: true,
    },
  ],
};

describe("SurveyRunner validation error policy", () => {
  it("uses an in-page alert, not a toast, for validation failures", async () => {
    toastError.mockReset();
    render(
      <I18nProvider>
        <SurveyRunner survey={SURVEY} initialToken="tok" initialLanguage="en" />
      </I18nProvider>,
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(pickText(UI.errorSummaryTitle, "en"));
    expect(alert).toHaveTextContent(pickText(UI.required, "en"));

    await waitFor(() => expect(toastError).not.toHaveBeenCalled());
  });
});
