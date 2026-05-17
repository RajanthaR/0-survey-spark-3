/**
 * Production safety: the "Continue anyway (preview only)" escape hatch
 * MUST NOT render on a production hostname, even after the server rejects
 * the Turnstile challenge. This pins the client-side gate
 *   `allowBypass = import.meta.env.DEV || /local preview hostnames/`
 * so a future refactor can't accidentally ship the bypass to real users.
 *
 * Defence in depth: even if the button were forced into the DOM (or a
 * tester crafted a request with `bypassTurnstile: true` by hand), the
 * server still rejects unless `ALLOW_TURNSTILE_BYPASS=true` is set on the
 * deploy — pinned separately by responses.turnstileGuard.test.ts.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => {} }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));

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
  slug: "bypass-hidden-prod",
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
  act(() => btn.click());
}
function clickOptionalContinue(container: HTMLElement) {
  const btn = container.querySelector("main button.h-14.flex-1") as HTMLButtonElement;
  act(() => btn.click());
}

const ORIGINAL_LOCATION = window.location;

function setHostname(hostname: string) {
  // jsdom's location is non-writable; replace with a stand-in.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, hostname, href: `https://${hostname}/` },
  });
}

beforeEach(() => {
  startResponse.mockReset();
  vi.stubEnv("DEV", false);
});

afterEach(() => {
  vi.unstubAllEnvs();
  Object.defineProperty(window, "location", { configurable: true, value: ORIGINAL_LOCATION });
});

describe("SurveyRunner — production bypass safety", () => {
  it.each([
    ["custom production domain", "research.example.org"],
    ["www production domain", "www.research.example.org"],
    ["staging production-like domain", "staging.research.example.org"],
  ])(
    "does NOT render 'Continue anyway' after a Turnstile rejection on %s",
    async (_label, hostname) => {
      setHostname(hostname);
      startResponse.mockRejectedValueOnce(
        new Error(
          "Verification failed (invalid-input-response). Please refresh the challenge and try again.",
        ),
      );

      const { container } = render(
        <I18nProvider>
          <SurveyRunner survey={SURVEY} initialLanguage="en" />
        </I18nProvider>,
      );

      // intro → consent (required) → consent-optional
      clickMainCta(container);
      clickMainCta(container);

      await act(async () => {
        clickOptionalContinue(container);
      });

      // The inline verification error MUST appear (proof we hit the
      // rejection branch), but the bypass button must NOT.
      await waitFor(() => {
        expect(document.querySelector('[data-testid="consent-verify-error"]')).toBeTruthy();
      });
      expect(document.querySelector('[data-testid="consent-verify-bypass"]')).toBeNull();
      // Literal copy must not leak into the DOM either.
      expect(document.body.textContent ?? "").not.toMatch(/Continue anyway/i);
    },
  );

  it("server-side: a manipulated client request with bypassTurnstile=true is rejected when ALLOW_TURNSTILE_BYPASS is unset", async () => {
    // Tester opens devtools, sets `bypassTurnstile: true` on the RPC body.
    // The serverFn surface throws a verification error and never advances.
    setHostname("research.example.org");
    startResponse.mockRejectedValueOnce(
      new Error("Please complete the human-verification challenge before continuing."),
    );

    const { container } = render(
      <I18nProvider>
        <SurveyRunner survey={SURVEY} initialLanguage="en" />
      </I18nProvider>,
    );
    clickMainCta(container);
    clickMainCta(container);
    await act(async () => {
      clickOptionalContinue(container);
    });

    await waitFor(() => {
      expect(document.querySelector('[data-testid="consent-verify-error"]')).toBeTruthy();
    });
    // Runner stayed on the consent panel — no question input mounted.
    expect(document.querySelector("main textarea, main input[type=text]")).toBeNull();
    // And the bypass button is still hidden.
    expect(document.querySelector('[data-testid="consent-verify-bypass"]')).toBeNull();
  });
});
