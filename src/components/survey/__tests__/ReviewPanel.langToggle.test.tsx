/**
 * Regression: toggling the active language re-derives every piece of text
 * rendered by ReviewPanel (section headings, question labels, formatted
 * answer values for choice/yes_no, and the missing-required banner copy).
 *
 * If a future change memoizes any of this against the initial render or
 * caches translated strings per question, these assertions will fail.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider, UI, pickText } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

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

import { ReviewPanel } from "@/components/survey/ReviewPanel";

const SURVEY: Survey = {
  slug: "lang-review",
  title: { en: "T", si: "T", ta: "T" },
  subtitle: { en: "", si: "", ta: "" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      required: true,
      section: { en: "Personal", si: "පුද්ගලික", ta: "தனிப்பட்ட" },
      label: { en: "Your name", si: "ඔබේ නම", ta: "உங்கள் பெயர்" },
    },
    {
      id: "q2",
      type: "single_choice",
      required: true,
      section: { en: "Preferences", si: "මනාප", ta: "விருப்பங்கள்" },
      label: { en: "Favourite colour", si: "ප්‍රියතම වර්ණය", ta: "பிடித்த நிறம்" },
      options: [
        { value: "red", label: { en: "Red", si: "රතු", ta: "சிவப்பு" } },
        { value: "blue", label: { en: "Blue", si: "නිල්", ta: "நீலம්" } },
      ],
    },
    {
      id: "q3",
      type: "yes_no",
      required: true,
      section: { en: "Preferences", si: "මනාප", ta: "விருப்பங்கள்" },
      label: { en: "Do you agree?", si: "ඔබ එකඟද?", ta: "ஒப்புக்கொள்கிறீர்களா?" },
    },
  ],
};

function renderAt(lang: "en" | "si" | "ta") {
  return render(
    <I18nProvider>
      <ReviewPanel
        survey={SURVEY}
        answers={{ q1: "Asha", q2: "blue", q3: "yes" }}
        lang={lang}
        onEdit={() => {}}
        onContinue={() => {}}
      />
    </I18nProvider>,
  );
}

describe("ReviewPanel — language toggle re-derivation", () => {
  it("re-renders section headings, question labels, and answer values in Sinhala", () => {
    const { rerender } = renderAt("en");
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("Your name")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
    // English yes label from YES_NO_OPTIONS
    expect(screen.getByText(pickText(UI.reviewTitle, "en"))).toBeInTheDocument();

    rerender(
      <I18nProvider>
        <ReviewPanel
          survey={SURVEY}
          answers={{ q1: "Asha", q2: "blue", q3: "yes" }}
          lang="si"
          onEdit={() => {}}
          onContinue={() => {}}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("පුද්ගලික")).toBeInTheDocument();
    expect(screen.getByText("ඔබේ නම")).toBeInTheDocument();
    expect(screen.getByText("නිල්")).toBeInTheDocument();
    expect(screen.getByText(pickText(UI.reviewTitle, "si"))).toBeInTheDocument();
    // English remnants gone
    expect(screen.queryByText("Personal")).toBeNull();
    expect(screen.queryByText("Blue")).toBeNull();
  });

  it("re-renders the missing-required banner copy in the active language", () => {
    const { rerender } = render(
      <I18nProvider>
        <ReviewPanel
          survey={SURVEY}
          answers={{ q1: "", q2: "", q3: "" }}
          lang="en"
          onEdit={() => {}}
          onContinue={() => {}}
        />
      </I18nProvider>,
    );
    const enBanner = screen.getByRole("status").textContent ?? "";
    expect(enBanner.toLowerCase()).toContain(pickText(UI.required, "en").toLowerCase());

    rerender(
      <I18nProvider>
        <ReviewPanel
          survey={SURVEY}
          answers={{ q1: "", q2: "", q3: "" }}
          lang="ta"
          onEdit={() => {}}
          onContinue={() => {}}
        />
      </I18nProvider>,
    );
    const taBanner = screen.getByRole("status").textContent ?? "";
    expect(taBanner.toLowerCase()).toContain(pickText(UI.required, "ta").toLowerCase());
  });
});
