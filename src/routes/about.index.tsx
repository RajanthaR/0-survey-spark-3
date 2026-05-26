import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { ABOUT_SECTIONS } from "@/about/lib/sections";

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
  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Research explorer
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">About this research</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          A shared entry point for participant context, research evidence, engineering records, and
          presentation-ready summaries.
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
              Lane {section.laneNumber}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Open {section.label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
