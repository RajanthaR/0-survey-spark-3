import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Navigate, Outlet, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { adminBootstrap } from "@/lib/admin.functions";
import { AdminSessionProvider } from "@/routes/admin/-shared/context";
import { CenteredCard } from "@/routes/admin/-primitives";
import { LoginPanel } from "@/routes/admin/-LoginPanel";

type AdminSearch = {
  tab?: string;
  view?: string;
  section?: string;
};

const LEGACY_TARGETS: Record<string, string> = {
  stats: "/admin/stats",
  dashboard: "/admin/stats",
  responses: "/admin/responses",
  response: "/admin/responses",
  exports: "/admin/exports",
  export: "/admin/exports",
  reports: "/admin/reports",
  report: "/admin/reports",
  analytics: "/admin/reports",
  alerts: "/admin/alerts",
  alert: "/admin/alerts",
};

export const Route = createFileRoute("/admin")({
  component: AdminRoute,
  validateSearch: (search: Record<string, unknown>): AdminSearch => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
    view: typeof search.view === "string" ? search.view : undefined,
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Admin — EIP Insight" },
      { name: "description", content: "Researcher dashboard for EIP Insight." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function AdminRoute() {
  const [session, setSession] = useState<{ email: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const bootstrapFn = useServerFn(adminBootstrap);
  const search = Route.useSearch();
  const location = useLocation();

  const legacyTarget = useMemo(() => {
    const raw = search.tab ?? search.view ?? search.section;
    return raw ? LEGACY_TARGETS[raw.toLowerCase()] : undefined;
  }, [search.section, search.tab, search.view]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s?.user ? { email: s.user.email ?? "" } : null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session?.user ? { email: data.session.user.email ?? "" } : null);
      setChecking(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(false);
      return;
    }
    bootstrapFn({})
      .then((r) => setIsAdmin(r.isAdmin))
      .catch(() => setIsAdmin(false));
  }, [session, bootstrapFn]);

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <LoginPanel />;
  if (!isAdmin) return <Unauthorized />;

  if (legacyTarget) return <Navigate to={legacyTarget} replace />;
  if (location.pathname === "/admin") return <Navigate to="/admin/stats" replace />;

  return (
    <AdminSessionProvider value={{ email: session.email }}>
      <Outlet />
    </AdminSessionProvider>
  );
}

function Unauthorized() {
  return (
    <CenteredCard>
      <h1 className="text-lg font-semibold">Not authorized</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This account isn't an admin. To bootstrap the first admin, set the
        <code className="mx-1 rounded bg-muted px-1">ADMIN_BOOTSTRAP_EMAIL</code>
        backend secret to this account's email and reload.
      </p>
      <Button variant="outline" className="mt-4" onClick={() => supabase.auth.signOut()}>
        <LogOut className="mr-2 size-4" />
        Sign out
      </Button>
    </CenteredCard>
  );
}
