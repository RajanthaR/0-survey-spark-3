import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { MarkdownView } from "@/about/components/MarkdownView";
import {
  LiveResponseCountsView,
  useResearchAggregates,
  type ResearchAggregatesState,
} from "@/about/components/research/LiveResponseCounts";
import { MilestoneTimeline } from "@/about/components/research/MilestoneTimeline";
import { PhaseTimeline } from "@/about/components/research/PhaseTimeline";
import { SampleFlowDiagram } from "@/about/components/research/SampleFlowDiagram";
import { StudyAtAGlanceCard } from "@/about/components/research/StudyAtAGlanceCard";
import { getAboutSection } from "@/about/lib/sections";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import frameworkSource from "@/about/content/research/01-framework.md?raw";
import samplingEthicsSource from "@/about/content/research/02-sampling-ethics.md?raw";

const researchNavSections = [
  { id: "snapshot", label: "Snapshot" },
  { id: "framework", label: "Question and framework" },
  { id: "instrument", label: "Two-phase instrument" },
  { id: "ethics", label: "Sampling and ethics" },
  { id: "progress", label: "Progress" },
] as const;

type ResearchSectionId = (typeof researchNavSections)[number]["id"];

export const Route = createFileRoute("/about/research")({
  component: ResearchLane,
  head: () => ({
    meta: [
      { title: "Research narrative - EIP Insight" },
      { name: "description", content: getAboutSection("research").description },
      { property: "og:title", content: "Research narrative - EIP Insight" },
      { property: "og:description", content: getAboutSection("research").description },
      { property: "og:url", content: "/about/research" },
    ],
    links: [{ rel: "canonical", href: "/about/research" }],
  }),
});

function ResearchLane() {
  const aggregateState = useResearchAggregates();
  return <ResearchLaneContent aggregateState={aggregateState} />;
}

export function ResearchLaneContent({
  aggregateState,
}: {
  aggregateState: ResearchAggregatesState;
}) {
  const activeSection = useActiveResearchSection();

  return (
    <article lang="en" dir="ltr" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_190px]">
      <div className="min-w-0">
        <header className="mb-8 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Lane 2</Badge>
            <Badge variant="outline">Research narrative</Badge>
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
              Methodology, instrument, and progress
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              A presentation-ready view for supervisors, examiners, and collaborators reviewing what
              the study asks, why the two phases fit together, and how response collection is
              progressing.
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-10">
          <section id="snapshot" className="scroll-mt-24">
            <div className="grid gap-4 xl:grid-cols-2">
              <StudyAtAGlanceCard />
              <LiveResponseCountsView state={aggregateState} />
            </div>
          </section>

          <ResearchSection
            id="framework"
            eyebrow="Candidate-authored"
            title="Research question and framework"
          >
            <MarkdownView
              source={frameworkSource}
              basePath="src/about/content/research/01-framework.md"
            />
          </ResearchSection>

          <ResearchSection
            id="instrument"
            eyebrow="Canonical instrument"
            title="Two-phase survey design"
          >
            <div className="flex flex-col gap-6">
              <PhaseTimeline
                aggregates={aggregateState.status === "success" ? aggregateState.data : undefined}
              />
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Participant pathway</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    The flow keeps consent, optional resume, final submission, and aggregate
                    analysis separate.
                  </p>
                </div>
                <SampleFlowDiagram />
              </div>
            </div>
          </ResearchSection>

          <ResearchSection
            id="ethics"
            eyebrow="Candidate-authored"
            title="Sampling, ethics, and consent"
          >
            <MarkdownView
              source={samplingEthicsSource}
              basePath="src/about/content/research/02-sampling-ethics.md"
            />
          </ResearchSection>

          <section id="progress" className="scroll-mt-24">
            <MilestoneTimeline />
          </section>
        </div>
      </div>

      <aside className="hidden lg:block">
        <nav
          className="sticky top-6 flex flex-col gap-2 rounded-xl border bg-card p-3"
          aria-label="Research page sections"
        >
          <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            On this page
          </p>
          <Separator />
          {researchNavSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={cn(
                "rounded-md px-2 py-2 text-sm transition hover:bg-accent/30",
                activeSection === section.id
                  ? "bg-primary text-primary-foreground hover:bg-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={activeSection === section.id ? "true" : undefined}
            >
              {section.label}
            </a>
          ))}
        </nav>
      </aside>
    </article>
  );
}

function ResearchSection({
  children,
  eyebrow,
  id,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  id: ResearchSectionId;
  title: string;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function useActiveResearchSection(): ResearchSectionId {
  const [active, setActive] = useState<ResearchSectionId>("snapshot");

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id as ResearchSectionId);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.25, 0.5, 1] },
    );

    for (const section of researchNavSections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  return active;
}
