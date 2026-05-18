import { createFileRoute } from "@tanstack/react-router";

import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { useAdminSession } from "@/routes/admin/-shared/context";

export const Route = createFileRoute("/admin/stats")({
  component: AdminStatsRoute,
});

function AdminStatsRoute() {
  const { email } = useAdminSession();
  return <AdminDashboard email={email} activeSection="stats" />;
}
