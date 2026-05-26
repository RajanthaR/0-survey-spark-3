import { createFileRoute } from "@tanstack/react-router";

import { SlideDeck } from "@/about/components/present/SlideDeck";
import { SLIDES } from "@/about/content/present/deck";
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
  return <SlideDeck slides={SLIDES} />;
}
