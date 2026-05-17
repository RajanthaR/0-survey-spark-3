import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { getGlobalStartContext } from "@tanstack/start-client-core";
import { routeTree } from "./routeTree.gen";
import type { Lang } from "@/lib/i18n";

type ServerStartContext = {
  nonce?: string;
  initialLang?: Lang;
};

export const getRouter = () => {
  const queryClient = new QueryClient();
  const serverContext = getGlobalStartContext() as ServerStartContext | undefined;
  const nonce = typeof serverContext?.nonce === "string" ? serverContext.nonce : undefined;
  const initialLang =
    serverContext?.initialLang === "si" ||
    serverContext?.initialLang === "ta" ||
    serverContext?.initialLang === "en"
      ? serverContext.initialLang
      : "en";

  const router = createRouter({
    routeTree,
    context: { queryClient, initialLang },
    ssr: nonce ? { nonce } : undefined,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
