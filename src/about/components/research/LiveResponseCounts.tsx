import { useQuery } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { Activity, Clock, Database, Languages, ShieldCheck } from "lucide-react";

import type { PublicCount, ResearchAggregates } from "@/about/server/research-aggregates.types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export type ResearchAggregatesState =
  | { status: "loading"; data?: undefined; error?: null }
  | { status: "error"; data?: undefined; error: Error }
  | { status: "success"; data: ResearchAggregates; error?: null };

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Live counts unavailable.");
}

async function fetchResearchAggregates(): Promise<ResearchAggregates> {
  const response = await fetch("/api/about/research-aggregates", {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Live counts unavailable (${response.status}).`);
  }

  return (await response.json()) as ResearchAggregates;
}

export function useResearchAggregates(): ResearchAggregatesState {
  const query = useQuery({
    queryKey: ["about", "research", "aggregates"],
    queryFn: fetchResearchAggregates,
    refetchInterval: 60_000,
    retry: 1,
    staleTime: 60_000,
  });

  // Prefer cached data over an errored background refetch
  // (stale-while-revalidate UX — don't flash an error if we already have counts).
  if (query.data) return { status: "success", data: query.data };
  if (query.isError) return { status: "error", error: toError(query.error) };
  return { status: "loading" };
}

export function LiveResponseCounts() {
  return <LiveResponseCountsView state={useResearchAggregates()} />;
}

export function LiveResponseCountsView({ state }: { state: ResearchAggregatesState }) {
  if (state.status === "loading") {
    return (
      <Card className="h-full">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card className="h-full">
        <CardHeader>
          <Badge variant="secondary">Live response counts</Badge>
          <CardTitle className="text-2xl">Counts unavailable</CardTitle>
          <CardDescription>
            The research narrative remains available without live database counts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Activity className="size-4" aria-hidden="true" />
            <AlertTitle>Live counts unavailable</AlertTitle>
            <AlertDescription>{state.error.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const data = state.data;

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Live response counts</Badge>
          <Badge variant="outline">Masked below 10</Badge>
        </div>
        <CardTitle className="text-2xl">Anonymised collection status</CardTitle>
        <CardDescription>
          Aggregate counts only. No answers, contact details, resume tokens, or user-agent data are
          exposed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            icon={ShieldCheck}
            label="Completed submissions"
            value={data.completed.all}
            note="Headline research sample"
          />
          <StatTile
            icon={Database}
            label="Started responses"
            value={data.started.all}
            note="Includes in-progress rows"
          />
          <StatTile
            icon={Activity}
            label="In progress"
            value={data.inProgress.all}
            note="Saved but not submitted"
          />
          <StatTile
            icon={Clock}
            label="Last response"
            value={formatLastResponse(data.lastResponseAgeHours)}
            note="Based on latest start time"
          />
        </div>

        <Separator />

        <div className="grid gap-4 lg:grid-cols-2">
          <Breakdown
            title="Completed by phase"
            items={[
              ["Phase 1", data.completed.byPhase["phase-1"]],
              ["Phase 3", data.completed.byPhase["phase-3"]],
            ]}
          />
          <Breakdown
            title="Completed by language"
            icon={Languages}
            items={[
              ["English", data.completed.byLang.en],
              ["Sinhala", data.completed.byLang.si],
              ["Tamil", data.completed.byLang.ta],
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function formatLastResponse(hours: number | null): PublicCount {
  if (hours == null) return { value: null, label: "No responses yet", masked: false };
  if (hours === 0) return { value: 0, label: "Within the last hour", masked: false };
  return {
    value: hours,
    label: `${hours} hour${hours === 1 ? "" : "s"} ago`,
    masked: false,
  };
}

function StatTile({
  icon: Icon,
  label,
  note,
  value,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: "true" }>;
  label: string;
  note: string;
  value: PublicCount;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold leading-none text-foreground">{value.label}</p>
        </div>
        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {note}
        {value.masked ? " - privacy masked" : ""}
      </p>
    </div>
  );
}

function Breakdown({
  icon: Icon,
  items,
  title,
}: {
  icon?: ComponentType<{ className?: string; "aria-hidden"?: "true" }>;
  items: Array<[string, PublicCount]>;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-primary" aria-hidden="true" />}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <dl className="grid gap-2">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2"
          >
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold text-foreground">{value.label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
