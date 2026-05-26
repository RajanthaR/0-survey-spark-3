import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { getAboutSection } from "@/about/lib/sections";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EngineeringStoryMode = lazy(
  () => import("@/about/components/engineering/EngineeringStoryMode"),
);
const EngineeringDocsMode = lazy(
  () => import("@/about/components/engineering/EngineeringDocsMode"),
);
const AuditDashboardMode = lazy(() => import("@/about/components/engineering/AuditDashboardMode"));

const ENGINEERING_MODES = ["story", "browser", "dashboard"] as const;
type EngineeringMode = (typeof ENGINEERING_MODES)[number];

function isEngineeringMode(value: unknown): value is EngineeringMode {
  return typeof value === "string" && ENGINEERING_MODES.includes(value as EngineeringMode);
}

export const Route = createFileRoute("/about/engineering")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: isEngineeringMode(search.mode) ? search.mode : undefined,
    doc: typeof search.doc === "string" ? search.doc : undefined,
  }),
  component: EngineeringLane,
  head: () => ({
    meta: [
      { title: "Engineering lane - EIP Insight" },
      { name: "description", content: getAboutSection("engineering").description },
    ],
  }),
});

function ModeFallback() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading engineering content">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function EngineeringLane() {
  const { mode, doc } = Route.useSearch();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const activeMode = mode ?? "story";

  useEffect(() => {
    setMounted(true);
  }, []);

  function setMode(value: string) {
    const nextMode = isEngineeringMode(value) ? value : "story";
    void navigate({
      to: "/about/engineering",
      search: {
        mode: nextMode === "story" ? undefined : nextMode,
        doc: nextMode === "browser" ? doc : undefined,
      },
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Engineering lane
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">
            System Architecture And Audit Trail
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Architecture diagrams, repository documentation, and audit status for reviewers.
          </p>
        </div>
        <Tabs value={activeMode} onValueChange={setMode}>
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="story">Architecture</TabsTrigger>
            <TabsTrigger value="browser">Docs</TabsTrigger>
            <TabsTrigger value="dashboard">Audit status</TabsTrigger>
          </TabsList>
          {!mounted ? (
            <ModeFallback />
          ) : (
            <Suspense fallback={<ModeFallback />}>
              {activeMode === "story" && (
                <TabsContent value="story" className="mt-6">
                  <EngineeringStoryMode />
                </TabsContent>
              )}
              {activeMode === "browser" && (
                <TabsContent value="browser" className="mt-6">
                  <EngineeringDocsMode doc={doc} />
                </TabsContent>
              )}
              {activeMode === "dashboard" && (
                <TabsContent value="dashboard" className="mt-6">
                  <AuditDashboardMode />
                </TabsContent>
              )}
            </Suspense>
          )}
        </Tabs>
      </div>
      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Last build SHA: <code className="rounded bg-muted px-1 py-0.5">{__COMMIT_SHA__}</code>
      </footer>
    </div>
  );
}
