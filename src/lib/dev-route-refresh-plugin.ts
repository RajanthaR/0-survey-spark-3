import type { Plugin } from "vite";
import path from "node:path";

/**
 * Dev-only Vite plugin that forces a full page reload when survey content,
 * route files, or the auto-generated route tree change. This prevents stale
 * module references that previously caused SSR blank screens after adding
 * a new route file.
 */
export function devRouteRefreshPlugin(): Plugin {
  const watched = [
    path.posix.normalize("src/routes/"),
    path.posix.normalize("src/surveys/"),
    path.posix.normalize("src/routeTree.gen.ts"),
  ];

  return {
    name: "survey-spark:dev-route-refresh",
    apply: "serve",
    handleHotUpdate({ file, server }) {
      const normalized = file.split(path.sep).join("/");
      if (!watched.some((w) => normalized.includes(w))) return;

      // Invalidate the SSR module graph so the next request rebuilds the
      // route tree from disk instead of serving a cached closure.
      server.moduleGraph.invalidateAll();
      server.ws.send({ type: "full-reload", path: "*" });
      server.config.logger.info(
        `[survey-spark] route/survey change detected (${normalized}) — full reload`,
      );
      return [];
    },
  };
}
