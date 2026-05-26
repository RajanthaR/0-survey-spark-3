import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { ABOUT_UI, aboutLaneLabel, aboutOpenLabel } from "@/about/copy/ui";
import { ABOUT_SECTIONS } from "@/about/lib/sections";
import { pickText, useLang } from "@/lib/i18n";

export const Route = createFileRoute("/about/")({
  component: AboutHub,
  head: () => ({
    meta: [
      { title: "About this research - EIP Insight" },
      {
        name: "description",
        content: "A four-lane hub for the EIP Insight research explorer.",
      },
    ],
  }),
});

function AboutHub() {
  const { lang } = useLang();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {pickText(ABOUT_UI.hubEyebrow, lang)}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">
          {pickText(ABOUT_UI.hubTitle, lang)}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {pickText(ABOUT_UI.hubDescription, lang)}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {ABOUT_SECTIONS.map((section) => (
          <Link
            key={section.id}
            to={section.path}
            className="block rounded-2xl border bg-card p-5 transition hover:bg-accent/30"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {aboutLaneLabel(section.laneNumber, lang)}
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              {pickText(ABOUT_UI.sections[section.id].title, lang)}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {pickText(ABOUT_UI.sections[section.id].description, lang)}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              {aboutOpenLabel(section.id, lang)}
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
