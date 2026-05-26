import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AboutLayout } from "@/about/layout/AboutLayout";

export const Route = createFileRoute("/about")({
  component: AboutRoute,
  head: () => ({
    meta: [
      { title: "About this research - EIP Insight" },
      {
        name: "description",
        content:
          "Explore the study, research, engineering, and presentation context behind EIP Insight.",
      },
    ],
  }),
});

function AboutRoute() {
  return (
    <AboutLayout>
      <Outlet />
    </AboutLayout>
  );
}
