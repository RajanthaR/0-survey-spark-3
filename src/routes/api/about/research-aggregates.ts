import { createFileRoute } from "@tanstack/react-router";

const CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=600";

export const Route = createFileRoute("/api/about/research-aggregates")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getResearchAggregates } =
            await import("@/about/server/research-aggregates.impl.server");
          return Response.json(await getResearchAggregates(), {
            headers: { "Cache-Control": CACHE_CONTROL },
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Live counts are temporarily unavailable.";
          return Response.json(
            { error: message },
            {
              status: 503,
              headers: { "Cache-Control": "no-store" },
            },
          );
        }
      },
    },
  },
});
