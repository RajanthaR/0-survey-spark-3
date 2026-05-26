import { CalendarCheck, CircleDot, Clock3 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import milestonesSource from "@/about/content/research/milestones.json?raw";

const milestoneStatuses = ["done", "in-progress", "upcoming"] as const;

export type MilestoneStatus = (typeof milestoneStatuses)[number];

export type Milestone = {
  date: string;
  label: string;
  status: MilestoneStatus;
};

export function parseMilestones(source: string): Milestone[] {
  const parsed = JSON.parse(source) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Milestones must be a JSON array.");

  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Milestone ${index + 1} must be an object.`);
    }

    const record = item as Record<string, unknown>;
    const status = record.status;
    if (
      typeof record.date !== "string" ||
      typeof record.label !== "string" ||
      !milestoneStatuses.includes(status as MilestoneStatus)
    ) {
      throw new Error(`Milestone ${index + 1} has an invalid date, label, or status.`);
    }

    return {
      date: record.date,
      label: record.label,
      status: status as MilestoneStatus,
    };
  });
}

const dateFormatter = new Intl.DateTimeFormat("en-LK", {
  day: "numeric",
  month: "short",
  year: "numeric",
  // Force UTC so a YYYY-MM-DD milestone renders as the same calendar date
  // regardless of where the viewer's browser is.
  timeZone: "UTC",
});

export function MilestoneTimeline({
  milestones = parseMilestones(milestonesSource),
}: {
  milestones?: Milestone[];
}) {
  return (
    <Card>
      <CardHeader>
        <Badge variant="secondary" className="w-fit">
          Progress
        </Badge>
        <CardTitle role="heading" aria-level={2} className="text-2xl">
          Milestones
        </CardTitle>
        <CardDescription>
          Candidate-editable timeline stored in <code>milestones.json</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {milestones.length ? (
          <ol className="relative flex flex-col gap-5 border-l pl-5">
            {milestones.map((milestone) => (
              <li key={`${milestone.date}-${milestone.label}`} className="relative">
                <span
                  className={cn(
                    "absolute -left-[1.85rem] top-0.5 flex size-7 items-center justify-center rounded-full border bg-card",
                    milestone.status === "done" &&
                      "border-primary bg-primary text-primary-foreground",
                    milestone.status === "in-progress" && "border-primary text-primary",
                  )}
                  aria-hidden="true"
                >
                  {milestone.status === "done" ? (
                    <CalendarCheck className="size-4" />
                  ) : milestone.status === "in-progress" ? (
                    <CircleDot className="size-4" />
                  ) : (
                    <Clock3 className="size-4" />
                  )}
                </span>
                <div className="flex flex-col gap-2 rounded-lg border bg-background p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{milestone.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatMilestoneDate(milestone.date)}
                    </p>
                  </div>
                  <MilestoneBadge status={milestone.status} />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Alert>
            <Clock3 className="size-4" aria-hidden="true" />
            <AlertTitle>No milestones yet</AlertTitle>
            <AlertDescription>
              Add milestone objects to the JSON file to populate this timeline.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function formatMilestoneDate(value: string): string {
  // Append `Z` so the date string is parsed as UTC; combined with the
  // UTC-configured formatter this prevents timezone drift on display.
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

function MilestoneBadge({ status }: { status: MilestoneStatus }) {
  if (status === "done") return <Badge>Done</Badge>;
  if (status === "in-progress") return <Badge variant="secondary">In progress</Badge>;
  return <Badge variant="outline">Upcoming</Badge>;
}
