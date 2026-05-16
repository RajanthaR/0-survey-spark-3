/**
 * D24 — autosave debounce + visibility-flush coverage.
 *
 * The runner debounces saves at 1500ms and flushes immediately when the
 * tab becomes hidden (visibilitychange) or the page is being unloaded
 * (pagehide). These tests use Vitest fake timers + a mocked `saveAnswers`
 * so we can assert exactly when the server fn fires without spinning a
 * real network or server.
 *
 * Why both events: mobile Safari fires `pagehide` without a preceding
 * `visibilitychange` when a user swipes back, so flush MUST be wired to
 * both. Regression-proof both wires here.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

const saveAnswersMock = vi.fn().mockResolvedValue({});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));
vi.mock("@/lib/responses.functions", () => ({
  startResponse: vi.fn().mockResolvedValue({ resumeToken: "tok-debounce" }),
  saveAnswers: (...args: unknown[]) => saveAnswersMock(...args),
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
  slug: "debounce-survey",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      required: false,
      section: { en: "S", si: "S", ta: "S" },
      label: { en: "Name", si: "නම", ta: "பெயர்" },
    },
  ],
};

function mount() {
  return render(
    <I18nProvider>
      <SurveyRunner
        survey={SURVEY}
        initialToken="tok-debounce"
        initialAnswers={{}}
        initialLanguage="en"
        initialStatus="in_progress"
      />
    </I18nProvider>,
  );
}

describe("SurveyRunner — autosave debounce", () => {
  beforeEach(() => {
    saveAnswersMock.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call saveAnswers before 1500ms have elapsed", async () => {
    mount();
    saveAnswersMock.mockClear();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Asha" } });

    await act(async () => {
      vi.advanceTimersByTime(1400);
    });
    expect(saveAnswersMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(200); // total 1600ms
    });
    expect(saveAnswersMock).toHaveBeenCalledTimes(1);
    expect(saveAnswersMock.mock.calls[0][0].data).toMatchObject({
      resumeToken: "tok-debounce",
      answers: { q1: "Asha" },
      language: "en",
    });
  });

  it("resets the debounce timer when a second edit lands inside the window", async () => {
    mount();
    saveAnswersMock.mockClear();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "A" } });

    // 1000ms in — first edit hasn't fired yet.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(saveAnswersMock).not.toHaveBeenCalled();

    // Second edit resets the 1500ms timer.
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Asha" } });
    await act(async () => {
      vi.advanceTimersByTime(1000); // total 2000ms, but only 1000ms past second edit
    });
    expect(saveAnswersMock).not.toHaveBeenCalled();

    // Crossing the 1500ms boundary past the second edit fires once.
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    expect(saveAnswersMock).toHaveBeenCalledTimes(1);
  });
});

describe("SurveyRunner — visibility flush", () => {
  beforeEach(() => {
    saveAnswersMock.mockClear();
  });

  it("flushes immediately on visibilitychange → hidden", async () => {
    mount();
    saveAnswersMock.mockClear();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Asha" } });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    await act(async () => {
      window.dispatchEvent(new Event("visibilitychange"));
    });
    expect(saveAnswersMock).toHaveBeenCalledTimes(1);
    expect(saveAnswersMock.mock.calls[0][0].data.answers).toEqual({ q1: "Asha" });
  });

  it("flushes immediately on pagehide", async () => {
    mount();
    saveAnswersMock.mockClear();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Mira" } });

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(saveAnswersMock).toHaveBeenCalledTimes(1);
    expect(saveAnswersMock.mock.calls[0][0].data.answers).toEqual({ q1: "Mira" });
  });

  it("does not double-save when payload is unchanged", async () => {
    mount();
    saveAnswersMock.mockClear();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Same" } });

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(saveAnswersMock).toHaveBeenCalledTimes(1);

    // Second pagehide with no further edits → still one call.
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(saveAnswersMock).toHaveBeenCalledTimes(1);
  });
});