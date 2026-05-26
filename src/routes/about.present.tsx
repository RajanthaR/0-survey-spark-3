import { createFileRoute } from "@tanstack/react-router";

import { LanePlaceholder } from "@/about/components/LanePlaceholder";
import { getAboutSection } from "@/about/lib/sections";

export const Route = createFileRoute("/about/present")({
  component: PresentLane,
  head: () => ({
    meta: [
      { title: "Presentation lane - EIP Insight" },
      { name: "description", content: getAboutSection("present").description },
    ],
  }),
});

function PresentLane() {
  return <LanePlaceholder section={getAboutSection("present")} />;
}
