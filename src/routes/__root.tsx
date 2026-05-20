import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { I18nProvider, pickText, UI, useLang, type Lang } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { registerOptionImageSW } from "@/lib/sw-register";
import { PerfDebugOverlay } from "@/components/PerfDebugOverlay";
import {
  NOTO_FONT_STYLESHEET_HREF,
  NOTO_FONT_STYLESHEET_ID,
  ensureNotoFontsForLang,
  shouldLoadNotoFonts,
} from "@/lib/noto-fonts";

function NotFoundComponent() {
  const { lang } = useLang();
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          {pickText(UI.notFoundTitle, lang)}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{pickText(UI.notFoundBody, lang)}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {pickText(UI.goHome, lang)}
          </Link>
        </div>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { lang } = useLang();

  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {pickText(UI.errorTitle, lang)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{pickText(UI.errorBody, lang)}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {pickText(UI.retry, lang)}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {pickText(UI.goHome, lang)}
          </a>
        </div>
      </div>
    </main>
  );
}

type RootRouteContext = { queryClient: QueryClient; initialLang: Lang };

export const Route = createRootRouteWithContext<RootRouteContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "EIP Insight — Sri Lanka Eco-Industrial Park research" },
      {
        name: "description",
        content:
          "A short, anonymous trilingual research survey by the University of Sri Jayewardenepura informing Sri Lanka's first Eco-Industrial Park model.",
      },
      { name: "author", content: "University of Sri Jayewardenepura" },
      { property: "og:site_name", content: "EIP Insight" },
      { property: "og:title", content: "EIP Insight — Sri Lanka Eco-Industrial Park research" },
      {
        property: "og:description",
        content:
          "Help shape Sri Lanka's first Eco-Industrial Park model — a short anonymous research survey.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const { initialLang } = Route.useRouteContext();
  const includeNotoFonts = shouldLoadNotoFonts(initialLang);
  return (
    <html lang={initialLang}>
      <head>
        <HeadContent />
        {includeNotoFonts && (
          <>
            <link
              id="noto-fonts-googleapis"
              rel="preconnect"
              href="https://fonts.googleapis.com"
              data-noto-fonts="true"
            />
            <link
              id="noto-fonts-gstatic"
              rel="preconnect"
              href="https://fonts.gstatic.com"
              crossOrigin="anonymous"
              data-noto-fonts="true"
            />
            <link
              id={NOTO_FONT_STYLESHEET_ID}
              rel="stylesheet"
              href={NOTO_FONT_STYLESHEET_HREF}
              data-noto-fonts="true"
            />
          </>
        )}
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-soft focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {pickText(UI.skipToMain, initialLang)}
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
function RootComponent() {
  const { queryClient, initialLang } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => {
    // Best-effort: register the option-image SW after first paint.
    registerOptionImageSW();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider initialLang={initialLang}>
        <NotoFontLoader />
        <Outlet />
        <Toaster />
        <PerfDebugOverlay />
      </I18nProvider>
    </QueryClientProvider>
  );
}

function NotoFontLoader() {
  const { lang } = useLang();
  useEffect(() => {
    ensureNotoFontsForLang(lang);
  }, [lang]);
  return null;
}
