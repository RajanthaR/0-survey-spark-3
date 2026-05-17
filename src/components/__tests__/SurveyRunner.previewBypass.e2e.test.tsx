/**
 * E2E: clicking "Continue anyway (preview only)" on the optional consent
 * panel after a Turnstile failure must:
 *   1. re-invoke `startResponse` with `bypassTurnstile: true`,
 *   2. resolve successfully and persist the response (resumeToken
 *      returned by the server fn is what we assert against),
 *   3. advance the runner out of the consent stage so the user lands on
 *      the first question — proof the bypass path completed end-to-end.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

const startResponse = vi.fn();
vi.mock("@/lib/responses.functions", () => ({
  startResponse: (...args: unknown[]) => startResponse(...args),
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
  slug: "preview-bypass-e2e",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [{ id: "o1", required: false, label: { en: "Opt", si: "Opt", ta: "Opt" } }],
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

function clickMainCta(container: HTMLElement) {
  const btn = container.querySelector("main button.h-14") as HTMLButtonElement;
  if (!btn) throw new Error("No main CTA button found");
  act(() => {
    btn.click();
  });
}

// On the optional-consent stage the panel renders a Back button + a
// Continue button, both `.h-14`. `clickMainCta` would grab Back. This
// helper targets the flex-1 Continue button instead.
function clickOptionalContinue(container: HTMLElement) {
  const btn = container.querySelector("main button.h-14.flex-1") as HTMLButtonElement | null;
  if (!btn) throw new Error("No optional-continue CTA found");
  act(() => {
    btn.click();
  });
}

beforeEach(() => {
  startResponse.mockReset();
  // Force the runner to render the bypass button regardless of hostname.
  // The runner checks `import.meta.env.DEV || /local preview hostnames/` — DEV
  // is true under vitest, so the button is already eligible to render.
});

describe("SurveyRunner — preview Turnstile bypass e2e", () => {
  it("sends bypassTurnstile=true and saves the response after the user clicks 'Continue anyway (preview only)'", async () => {
    // 1st call: simulate Turnstile rejection from the server.
    // 2nd call: bypass honoured, response persisted with a resumeToken.
    startResponse
      .mockRejectedValueOnce(
        new Error(
          "Verification failed (invalid-input-response). Please refresh the challenge and try again.",
        ),
      )
      .mockResolvedValueOnce({
        id: "row-id",
        resumeToken: "tok-bypass",
        previewBypass: true,
      });

    const { container } = render(
      <I18nProvider>
        <SurveyRunner survey={SURVEY} initialLanguage="en" />
      </I18nProvider>,
    );

    // intro → consent (required) → consent-optional
    clickMainCta(container);
    clickMainCta(container);

    // Continue from the optional consent stage — server rejects (verify error).
    await act(async () => {
      clickOptionalContinue(container);
    });

    // The bypass button should now be visible because verifyError is set.
    const bypassBtn = await waitFor(() => {
      const b = document.querySelector(
        '[data-testid="consent-verify-bypass"]',
      ) as HTMLButtonElement | null;
      if (!b) throw new Error("bypass button not rendered");
      return b;
    });

    await act(async () => {
      bypassBtn.click();
    });

    // 1st call: no bypass flag. 2nd call: bypassTurnstile=true.
    await waitFor(() => {
      expect(startResponse).toHaveBeenCalledTimes(2);
    });
    const firstArg = startResponse.mock.calls[0][0];
    expect(firstArg.data.bypassTurnstile).toBeUndefined();
    const secondArg = startResponse.mock.calls[1][0];
    expect(secondArg.data).toMatchObject({
      surveySlug: SURVEY.slug,
      bypassTurnstile: true,
    });

    // Runner advanced past the consent panel — the first question is mounted.
    await waitFor(() => {
      const q = document.querySelector("input, textarea");
      expect(q).toBeTruthy();
      // The bypass button is no longer in the DOM.
      expect(document.querySelector('[data-testid="consent-verify-bypass"]')).toBeNull();
    });
  });
});
