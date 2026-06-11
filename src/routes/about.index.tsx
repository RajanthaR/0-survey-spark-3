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
    <section className="flex flex-col gap-8">
      <div>
        <p className="glass-chip inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {pickText(ABOUT_UI.hubEyebrow, lang)}
        </p>
        <h1 className="mt-4 max-w-xl text-balance bg-gradient-to-br from-foreground via-primary to-primary-glow bg-clip-text text-3xl font-semibold text-transparent sm:text-4xl">
          {pickText(ABOUT_UI.hubTitle, lang)}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {pickText(ABOUT_UI.hubDescription, lang)}
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {ABOUT_SECTIONS.map((section) => (
          <Link
            key={section.id}
            to={section.path}
            className="group relative block overflow-hidden rounded-3xl border bg-card p-6 shadow-soft transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden="true"
              className="font-display pointer-events-none absolute -top-5 right-2 select-none text-[5rem] font-semibold leading-none text-primary/10"
            >
              {String(section.laneNumber).padStart(2, "0")}
            </span>
            <span
              aria-hidden="true"
              className="gradient-eco absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
            />
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {aboutLaneLabel(section.laneNumber, lang)}
            </p>
            <h2 className="mt-1 max-w-[85%] text-lg font-semibold">
              {pickText(ABOUT_UI.sections[section.id].title, lang)}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {pickText(ABOUT_UI.sections[section.id].description, lang)}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              {aboutOpenLabel(section.id, lang)}
              <ArrowRight
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
