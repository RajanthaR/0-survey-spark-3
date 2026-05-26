import { createFileRoute } from "@tanstack/react-router";

import { LanePlaceholder } from "@/about/components/LanePlaceholder";
import { getAboutSection } from "@/about/lib/sections";

export const Route = createFileRoute("/about/research")({
  component: ResearchLane,
  head: () => ({
    meta: [
      { title: "Research lane - EIP Insight" },
      { name: "description", content: getAboutSection("research").description },
    ],
  }),
});

function ResearchLane() {
  return <LanePlaceholder section={getAboutSection("research")} />;
}
