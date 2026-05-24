import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { I18nProvider, UI, pickText } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));
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

const SURVEY: Survey = {
  slug: "contact-labels",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Q1", si: "Q1", ta: "Q1" },
      required: false,
    },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("SurveyRunner contact form labels", () => {
  it("associates contact inputs with explicit labels", async () => {
    render(
      <I18nProvider>
        <SurveyRunner survey={SURVEY} initialToken="tok" initialLanguage="en" />
      </I18nProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("next-button"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: pickText(UI.next, "en") }));
    });

    const name = screen.getByLabelText(pickText(UI.nameLabel, "en")) as HTMLInputElement;
    const email = screen.getByLabelText(pickText(UI.emailLabel, "en")) as HTMLInputElement;
    const organization = screen.getByLabelText(pickText(UI.orgLabel, "en")) as HTMLInputElement;

    expect(name.id).toBeTruthy();
    expect(email.id).toBeTruthy();
    expect(organization.id).toBeTruthy();
    expect(new Set([name.id, email.id, organization.id]).size).toBe(3);
  });
});
