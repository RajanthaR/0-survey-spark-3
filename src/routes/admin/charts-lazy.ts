import { lazy } from "react";

/**
 * Lazy-loaded recharts wrappers. Extracted from admin.tsx (D19) so the
 * survey routes never download recharts and the admin dashboard import
 * graph stays narrow.
 */
export const DashboardCharts = {
  Daily: lazy(() =>
    import("@/components/admin/DashboardCharts").then((m) => ({ default: m.DailyLineChart })),
  ),
  Lang: lazy(() =>
    import("@/components/admin/DashboardCharts").then((m) => ({ default: m.LangPieChart })),
  ),
  Survey: lazy(() =>
    import("@/components/admin/DashboardCharts").then((m) => ({ default: m.SurveyBarChart })),
  ),
  QuestionCompletion: lazy(() =>
    import("@/components/admin/DashboardCharts").then((m) => ({
      default: m.QuestionCompletionChart,
    })),
  ),
  AnsweredSkipped: lazy(() =>
    import("@/components/admin/DashboardCharts").then((m) => ({ default: m.AnsweredSkippedBar })),
  ),
  Dropoff: lazy(() =>
    import("@/components/admin/DropoffChart").then((m) => ({ default: m.DropoffChart })),
  ),
};
