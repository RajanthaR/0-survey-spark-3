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
import { I18nProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { registerOptionImageSW } from "@/lib/sw-register";
import { PerfDebugOverlay } from "@/components/PerfDebugOverlay";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Content-Security-Policy. Delivered as a meta http-equiv so it ships
      // with the SSR HTML on every host (Cloudflare Worker / preview /
      // custom domain) without needing a separate edge config. The policy
      // is permissive enough for the existing app surface (Google Fonts,
      // Supabase REST + Realtime over wss, blob workers for chart export)
      // and explicitly allow-lists Cloudflare Turnstile so the consent
      // screen can load `https://challenges.cloudflare.com/turnstile/v0/api.js`
      // and render its challenge iframe. `'unsafe-inline'` on script-src is
      // required for the language pre-hydration `<script>` injected below
      // and the runtime scripts TanStack Start emits via `<Scripts />`.
      {
        httpEquiv: "Content-Security-Policy",
        content: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "form-action 'self'",
          "frame-ancestors 'self'",
          // Turnstile widget script + the in-app inline pre-hydration script.
          "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
          "script-src-elem 'self' 'unsafe-inline' https://challenges.cloudflare.com",
          // Turnstile renders its challenge in an iframe served from this origin.
          "frame-src 'self' https://challenges.cloudflare.com",
          "child-src 'self' https://challenges.cloudflare.com blob:",
          // Supabase REST / Storage / Realtime (wss) + Turnstile siteverify
          // is server-to-server, but the client also pings the same host
          // for telemetry on some browsers.
          "connect-src 'self' https: wss:",
          "img-src 'self' data: blob: https:",
          // Tailwind injects inline <style> blocks at build/runtime; Google
          // Fonts ships its CSS from fonts.googleapis.com.
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' data: https://fonts.gstatic.com",
          "worker-src 'self' blob:",
          "manifest-src 'self'",
        ].join("; "),
      },
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
    links: [
      { rel: "stylesheet", href: appCss },
      // Sinhala + Tamil web fonts so non-English glyphs render predictably.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;600;700&family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        // Pre-hydration: set <html lang> and a __eipLang global from
        // localStorage so the very first paint matches the user's choice.
        children:
          "(function(){try{var l=localStorage.getItem('eip.lang');if(l==='si'||l==='ta'||l==='en'){window.__eipLang=l;document.documentElement.lang=l;}}catch(e){}})();",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
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
      <I18nProvider>
        <Outlet />
        <Toaster />
        <PerfDebugOverlay />
      </I18nProvider>
    </QueryClientProvider>
  );
}
