import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { LanguageToggle } from "@/components/LanguageToggle";
import { pickText, useLang, UI } from "@/lib/i18n";
import { SURVEY_LIST } from "@/surveys";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "EIP Insight — Sri Lanka Eco-Industrial Park research" },
      {
        name: "description",
        content:
          "Take a short, anonymous trilingual survey from the University of Sri Jayewardenepura on sustainable industrial development in Sri Lanka.",
      },
      { property: "og:title", content: "EIP Insight — Sri Lanka Eco-Industrial Park research" },
      {
        property: "og:description",
        content: "Take a short, anonymous trilingual research survey on sustainable industry.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function Index() {
  const { lang } = useLang();
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">
          {pickText(UI.appName, lang)}
        </span>
        <LanguageToggle compact />
      </header>
      <main className="mx-auto max-w-2xl space-y-8 px-4 pb-20 pt-6">
        <section className="rounded-3xl gradient-eco p-8 text-primary-foreground shadow-soft">
          <p className="text-sm opacity-90">{pickText(UI.tagline, lang)}</p>
          <h1 className="mt-2 text-3xl font-semibold">{pickText(UI.appName, lang)}</h1>
          <p className="mt-3 text-sm opacity-90">{pickText(UI.intro, lang)}</p>
        </section>

        <section className="space-y-3">
          {SURVEY_LIST.map((s) => (
            <Link
              key={s.slug}
              to="/s/$slug"
              params={{ slug: s.slug }}
              search={{ token: undefined }}
              className="block rounded-2xl border bg-card p-5 transition hover:bg-accent/30"
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {s.slug}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{pickText(s.title, lang)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{pickText(s.subtitle, lang)}</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">~{s.estimatedMinutes} min</span>
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  {pickText(UI.start, lang)} <ArrowRight className="size-4" />
                </span>
              </div>
            </Link>
          ))}
        </section>

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/admin" className="underline">
            Researcher login
          </Link>
        </p>
      </main>
    </div>
  );
}
