import { ArrowRight } from "lucide-react";

import type { ResearchAggregates } from "@/about/server/research-aggregates.types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pickText } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SURVEY_LIST } from "@/surveys";
import type { Survey } from "@/surveys/types";

export type PhaseTimelineItem = {
  slug: "phase-1" | "phase-3";
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  questionCount: number;
  sections: string[];
};

export function buildPhaseTimelineItems(surveys: Survey[] = SURVEY_LIST): PhaseTimelineItem[] {
  return surveys
    .filter(
      (survey): survey is Survey & { slug: "phase-1" | "phase-3" } =>
        survey.slug === "phase-1" || survey.slug === "phase-3",
    )
    .map((survey) => {
      const sections: string[] = [];
      for (const question of survey.questions) {
        const label = pickText(question.section, "en");
        if (!sections.includes(label)) sections.push(label);
      }

      return {
        slug: survey.slug,
        title: pickText(survey.title, "en"),
        subtitle: pickText(survey.subtitle, "en"),
        estimatedMinutes: survey.estimatedMinutes,
        questionCount: survey.questions.filter((question) => question.type !== "section_header")
          .length,
        sections,
      };
    });
}

export function PhaseTimeline({
  aggregates,
  className,
  phases = buildPhaseTimelineItems(),
}: {
  aggregates?: ResearchAggregates;
  className?: string;
  phases?: PhaseTimelineItem[];
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        {phases.map((phase, index) => (
          <div key={phase.slug} className="contents">
            {index > 0 && (
              <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
                <div className="flex size-11 items-center justify-center rounded-full border bg-background text-primary">
                  <ArrowRight className="size-5" />
                </div>
              </div>
            )}
            <PhaseCard phase={phase} aggregates={aggregates} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseCard({
  aggregates,
  phase,
}: {
  aggregates?: ResearchAggregates;
  phase: PhaseTimelineItem;
}) {
  const completed = aggregates?.completed.byPhase[phase.slug].label ?? "Loading";
  const started = aggregates?.started.byPhase[phase.slug].label ?? "Loading";
  const inProgress = aggregates?.inProgress.byPhase[phase.slug].label ?? "Loading";

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{phase.slug === "phase-1" ? "Phase 1" : "Phase 3"}</Badge>
          <Badge variant="outline">~{phase.estimatedMinutes} min</Badge>
        </div>
        <CardTitle className="text-xl leading-tight">{phase.title}</CardTitle>
        <CardDescription>{phase.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-3 sm:grid-cols-3">
          <MiniStat label="Questions" value={String(phase.questionCount)} />
          <MiniStat label="Completed" value={completed} />
          <MiniStat label="In progress" value={inProgress} />
        </dl>
        <p className="text-xs text-muted-foreground">Started rows: {started}</p>
        <div className="flex flex-wrap gap-2">
          {phase.sections.map((section) => (
            <span
              key={section}
              className="rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground"
            >
              {section}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-foreground">{value}</dd>
    </div>
  );
}
