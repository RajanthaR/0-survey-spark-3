import { createServerFn } from "@tanstack/react-start";

export type {
  CountSet,
  PhaseSlug,
  PublicCount,
  ResearchAggregates,
  ResearchLang,
} from "@/about/server/research-aggregates.types";

export const getResearchAggregatesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=600");
  const { getResearchAggregates } = await import("./research-aggregates.impl.server");
  return getResearchAggregates();
});
