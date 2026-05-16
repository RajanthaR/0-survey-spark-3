import { describe, expect, it } from "vitest";
import { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import { I18nProvider, useLang, type Lang } from "@/lib/i18n";
import { QuestionCount, QuestionPosition } from "@/components/QuestionCount";

function SetLang({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const { setLang } = useLang();
  useEffect(() => {
    setLang(lang);
  }, [lang, setLang]);
  return <>{children}</>;
}

function RoundTrip({ target, children }: { target: Lang; children: React.ReactNode }) {
  const { setLang } = useLang();
  useEffect(() => {
    setLang("en");
    setLang(target);
    setLang("en");
    setLang(target);
  }, [target, setLang]);
  return <>{children}</>;
}

const LANGS: Lang[] = ["en", "si", "ta"];

describe.each(LANGS)("QuestionCount/QuestionPosition attributes (lang=%s)", (lang) => {
  it("QuestionCount sets data-testid + matching data-lang", () => {
    const { unmount } = render(
      <I18nProvider>
        <SetLang lang={lang}>
          <QuestionCount count={5} />
        </SetLang>
      </I18nProvider>,
    );
    const nodes = screen.getAllByTestId("question-count");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].getAttribute("data-lang")).toBe(lang);
    unmount();
  });

  it("QuestionPosition sets data-testid + matching data-lang", () => {
    const { unmount } = render(
      <I18nProvider>
        <SetLang lang={lang}>
          <QuestionPosition current={2} total={5} />
        </SetLang>
      </I18nProvider>,
    );
    const nodes = screen.getAllByTestId("question-position");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].getAttribute("data-lang")).toBe(lang);
    unmount();
  });

  it("data-lang reflects latest setLang round-trip (no stale value)", () => {
    const { unmount } = render(
      <I18nProvider>
        <RoundTrip target={lang}>
          <QuestionCount count={5} />
          <QuestionPosition current={2} total={5} />
        </RoundTrip>
      </I18nProvider>,
    );
    expect(screen.getByTestId("question-count").getAttribute("data-lang")).toBe(lang);
    expect(screen.getByTestId("question-position").getAttribute("data-lang")).toBe(lang);
    unmount();
  });

  it("explicit lang prop overrides context", () => {
    const { unmount } = render(
      <I18nProvider>
        <SetLang lang="en">
          <QuestionCount count={5} lang={lang} />
          <QuestionPosition current={2} total={5} lang={lang} />
        </SetLang>
      </I18nProvider>,
    );
    expect(screen.getByTestId("question-count").getAttribute("data-lang")).toBe(lang);
    expect(screen.getByTestId("question-position").getAttribute("data-lang")).toBe(lang);
    unmount();
  });
});

// Suppress unused warning for `act` import; kept for future use.
void act;
