/**
 * Smoke check that QuestionCount / QuestionPosition stay mounted, visible,
 * and not horizontally overflowing inside a typical mobile-header-sized
 * column at the narrowest supported viewport (320×568, iPhone SE class) in
 * every supported language. jsdom doesn't lay out real CSS, so we rely on
 * presence + visibility + a coarse character-width budget rather than
 * pixel-perfect measurements.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { I18nProvider, useLang, type Lang } from "@/lib/i18n";
import { QuestionCount, QuestionPosition } from "@/components/QuestionCount";

function SetLang({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const { setLang } = useLang();
  useEffect(() => {
    setLang(lang);
  }, [lang, setLang]);
  return <>{children}</>;
}

beforeAll(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 568 });
});

// Header column on a 320px viewport is ~280px wide after page padding.
const HEADER_COLUMN_PX = 280;
// Coarse heuristic: ~9px per glyph is generous for a small text-xs label,
// catching only egregious overflow (e.g. accidental concatenation of all
// translations into one node).
const PX_PER_GLYPH = 9;

const LANGS: Lang[] = ["en", "si", "ta"];

describe.each(LANGS)("QuestionCount/QuestionPosition on mobile viewport (lang=%s)", (lang) => {
  it("QuestionCount is mounted, visible, non-empty, and fits the header column", () => {
    const { unmount } = render(
      <div style={{ width: HEADER_COLUMN_PX }}>
        <I18nProvider>
          <SetLang lang={lang}>
            <QuestionCount count={39} />
          </SetLang>
        </I18nProvider>
      </div>,
    );
    const node = screen.getByTestId("question-count");
    expect(node).toBeInTheDocument();
    expect(node).toBeVisible();
    expect(node.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    const approxWidth = (node.textContent?.length ?? 0) * PX_PER_GLYPH;
    expect(approxWidth).toBeLessThanOrEqual(HEADER_COLUMN_PX);
    unmount();
  });

  it("QuestionPosition is mounted, visible, non-empty, and fits the header column", () => {
    const { unmount } = render(
      <div style={{ width: HEADER_COLUMN_PX }}>
        <I18nProvider>
          <SetLang lang={lang}>
            <QuestionPosition current={3} total={39} announce />
          </SetLang>
        </I18nProvider>
      </div>,
    );
    const node = screen.getByTestId("question-position");
    expect(node).toBeInTheDocument();
    expect(node).toBeVisible();
    expect(node.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    const approxWidth = (node.textContent?.length ?? 0) * PX_PER_GLYPH;
    expect(approxWidth).toBeLessThanOrEqual(HEADER_COLUMN_PX);
    unmount();
  });
});
