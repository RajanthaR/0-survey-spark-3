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
          // Never propagate internal error details to the client: this endpoint
          // returns aggregate research counts and a leaky error.message could
          // disclose Supabase schema, table names, or connection state.
          console.error("Failed to fetch research aggregates:", error);
          return Response.json(
            { error: "Live counts are temporarily unavailable." },
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
