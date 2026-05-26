import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n";

const routeState = vi.hoisted(() => ({ pathname: "/about/study" }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to }: { children: ReactNode; className?: string; to: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select?: (state: unknown) => unknown }) => {
    const state = { location: { pathname: routeState.pathname, search: {} } };
    return select ? select(state) : state;
  },
}));

vi.mock("@/components/LanguageToggle", () => ({
  LanguageToggle: () => <div data-testid="language-toggle" />,
}));

import { AboutLayout } from "@/about/layout/AboutLayout";

function renderLayout(pathname: string) {
  routeState.pathname = pathname;
  return render(
    <I18nProvider initialLang="en">
      <AboutLayout>
        <div>Lane content</div>
      </AboutLayout>
    </I18nProvider>,
  );
}

describe("AboutLayout", () => {
  it("keeps the language toggle on translated about lanes", () => {
    renderLayout("/about/study");

    expect(screen.getByTestId("language-toggle")).toBeInTheDocument();
  });

  it("hides the language toggle on English-only lanes", () => {
    const { rerender } = renderLayout("/about/research");

    expect(screen.queryByTestId("language-toggle")).not.toBeInTheDocument();

    routeState.pathname = "/about/engineering";
    rerender(
      <I18nProvider initialLang="en">
        <AboutLayout>
          <div>Lane content</div>
        </AboutLayout>
      </I18nProvider>,
    );

    expect(screen.queryByTestId("language-toggle")).not.toBeInTheDocument();
  });

  it("uses minimal chrome on the presentation route", () => {
    renderLayout("/about/present");

    expect(screen.getByText("Lane content")).toBeInTheDocument();
    expect(screen.queryByText("EIP Insight")).not.toBeInTheDocument();
    expect(screen.queryByTestId("language-toggle")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
