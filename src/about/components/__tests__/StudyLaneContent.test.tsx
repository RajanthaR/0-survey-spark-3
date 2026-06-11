import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { ABOUT_STUDY } from "@/about/copy/study";
import { LanguageToggle } from "@/components/LanguageToggle";
import { I18nProvider, LANGS, pickText, useLang } from "@/lib/i18n";
import { StudyLaneContent } from "@/routes/about.study";
import { CONSENT_ITEMS } from "@/surveys/consent";

function renderLink({
  to,
  className,
  children,
}: {
  to: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <a href={to} className={className}>
      {children}
    </a>
  );
}

function StudyHarness() {
  const { lang } = useLang();

  return (
    <>
      <LanguageToggle compact />
      <StudyLaneContent lang={lang} renderLink={renderLink} />
    </>
  );
}

describe("StudyLaneContent", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("switches study page copy through the shared LanguageToggle", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider initialLang="en">
        <StudyHarness />
      </I18nProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: pickText(ABOUT_STUDY.pageTitle, "en") }),
    ).toBeInTheDocument();

    const tamilButton = screen.getByRole("button", {
      name: LANGS.find((lang) => lang.code === "ta")!.label,
    });
    await user.click(tamilButton);

    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: pickText(ABOUT_STUDY.pageTitle, "ta") },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(pickText(ABOUT_STUDY.privacyHeading, "ta"), undefined, {
        timeout: 10_000,
      }),
    ).toBeInTheDocument();
  }, 30_000);

  it("renders canonical consent items from the survey consent source", () => {
    render(<StudyLaneContent lang="en" renderLink={renderLink} />);

    expect(
      screen.getByText(pickText(CONSENT_ITEMS[0]!.shortLabel ?? CONSENT_ITEMS[0]!.label, "en")),
    ).toBeInTheDocument();
    expect(screen.getByText(pickText(CONSENT_ITEMS.at(-1)!.label, "en"))).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(CONSENT_ITEMS.length);
  });
});
