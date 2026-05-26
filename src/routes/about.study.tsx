import { createFileRoute } from "@tanstack/react-router";

import { LanePlaceholder } from "@/about/components/LanePlaceholder";
import { getAboutSection } from "@/about/lib/sections";

export const Route = createFileRoute("/about/study")({
  component: StudyLane,
  head: () => ({
    meta: [
      { title: "Study lane - EIP Insight" },
      { name: "description", content: getAboutSection("study").description },
    ],
  }),
});

function StudyLane() {
  return <LanePlaceholder section={getAboutSection("study")} />;
}
