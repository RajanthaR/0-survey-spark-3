import { Award, CalendarDays, Landmark, ShieldCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { pickText } from "@/lib/i18n";
import { STUDY_META } from "@/surveys/consent";

const glanceRows = [
  {
    label: "Candidate",
    value: STUDY_META.primaryResearcher,
    icon: UserRound,
  },
  {
    label: "Supervisors",
    value: "Candidate to confirm",
    icon: Award,
  },
  {
    label: "Institution",
    value: STUDY_META.institution,
    icon: Landmark,
  },
  {
    label: "Study period",
    value: "2025-2027 (candidate to confirm)",
    icon: CalendarDays,
  },
  {
    label: "Ethics reference",
    value: STUDY_META.ercNumber,
    icon: ShieldCheck,
  },
] as const;

export function StudyAtAGlanceCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Study at a glance</Badge>
          <Badge variant="outline">English only</Badge>
        </div>
        <CardTitle className="text-2xl leading-tight">{pickText(STUDY_META.title, "en")}</CardTitle>
        <CardDescription>
          Status: Phase 1 data collection in progress. Phase 3 is prepared for the stakeholder
          instrument lane.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Separator />
        <dl className="grid gap-4">
          {glanceRows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="flex gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-6 text-foreground">{row.value}</dd>
                </div>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}
