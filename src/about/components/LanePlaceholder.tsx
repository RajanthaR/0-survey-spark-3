import type { AboutSection } from "@/about/lib/sections";

export function LanePlaceholder({ section }: { section: AboutSection }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Lane {section.laneNumber}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">{section.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {section.description}
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <h2 className="text-base font-semibold">Coming in lane {section.laneNumber}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Placeholder content for now. See{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{section.planPath}</code>.
        </p>
      </div>
    </section>
  );
}
