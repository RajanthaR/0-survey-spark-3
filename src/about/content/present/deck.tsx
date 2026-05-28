import {
  AuditScoreboard,
  buildAuditItems,
} from "@/about/components/engineering/AuditDashboardMode";
import type { SlideDefinition } from "@/about/components/present/types";
import { LiveResponseCounts } from "@/about/components/research/LiveResponseCounts";
import {
  buildPhaseTimelineItems,
  PhaseTimeline,
  type PhaseTimelineItem,
} from "@/about/components/research/PhaseTimeline";
import { SampleFlowDiagram } from "@/about/components/research/SampleFlowDiagram";
import { ABOUT_STUDY } from "@/about/copy/study";
import { parseMilestones } from "@/about/components/research/MilestoneTimeline";

import architectureOverviewSource from "@/about/diagrams/architecture-overview.mmd?raw";
import i18nPipelineSource from "@/about/diagrams/i18n-pipeline.mmd?raw";
import surveyWritePathSource from "@/about/diagrams/survey-write-path.mmd?raw";
import milestonesSource from "@/about/content/research/milestones.json?raw";

function phaseOnly(slug: PhaseTimelineItem["slug"]): PhaseTimelineItem[] {
  return buildPhaseTimelineItems().filter((phase) => phase.slug === slug);
}

function NextMilestones() {
  const milestones = parseMilestones(milestonesSource)
    .filter((milestone) => milestone.status !== "done")
    .slice(0, 3);

  return (
    <ol className="grid gap-4 text-2xl lg:text-3xl">
      {milestones.map((milestone) => (
        <li
          key={`${milestone.date}-${milestone.label}`}
          className="rounded-2xl border bg-background p-6"
        >
          <p className="font-semibold text-foreground">{milestone.label}</p>
          <p className="mt-2 text-lg uppercase tracking-[0.2em] text-primary">{milestone.date}</p>
        </li>
      ))}
    </ol>
  );
}

export const SLIDES: SlideDefinition[] = [
  {
    id: "title",
    kind: "title",
    props: {
      eyebrow: "EIP Insight",
      title: "Eco-Industrial Park research platform",
      subtitle: "Study status, instrument design, and system overview",
      meta: "Rajantha R Ambegala - University of Sri Jayewardenepura - 2026",
    },
  },
  {
    id: "why-eip",
    kind: "text",
    props: {
      eyebrow: "Why",
      text: "Eco-industrial parks can turn industrial growth into a coordinated model for resource efficiency, circularity, and cleaner production in Sri Lanka.",
    },
  },
  {
    id: "research-question",
    kind: "text",
    props: {
      eyebrow: "Research question",
      text: ABOUT_STUDY.whatItIsBody.en,
    },
  },
  {
    id: "phase-1-instrument",
    kind: "component",
    props: {
      eyebrow: "Instrument",
      title: "Phase 1: industry profile",
      children: <PhaseTimeline phases={phaseOnly("phase-1")} />,
    },
  },
  {
    id: "phase-3-instrument",
    kind: "component",
    props: {
      eyebrow: "Instrument",
      title: "Phase 3: detailed EIP readiness",
      children: <PhaseTimeline phases={phaseOnly("phase-3")} />,
    },
  },
  {
    id: "participant-pathway",
    kind: "component",
    props: {
      eyebrow: "Participant pathway",
      title: "Consent, resume, submit, aggregate",
      children: <SampleFlowDiagram />,
    },
  },
  {
    id: "where-we-are-now",
    kind: "component",
    props: {
      eyebrow: "Collection status",
      title: "Where we are now",
      children: <LiveResponseCounts />,
      footnote: "Counts below 10 are intentionally masked for respondent anonymity.",
    },
  },
  {
    id: "system-overview",
    kind: "diagram",
    props: {
      eyebrow: "System overview",
      title: "Application architecture",
      source: architectureOverviewSource,
    },
  },
  {
    id: "survey-write-path",
    kind: "diagram",
    props: {
      eyebrow: "Data path",
      title: "Survey response write path",
      source: surveyWritePathSource,
    },
  },
  {
    id: "i18n-pipeline",
    kind: "diagram",
    props: {
      eyebrow: "Internationalisation",
      title: "Trilingual content pipeline",
      source: i18nPipelineSource,
    },
  },
  {
    id: "audit-posture",
    kind: "component",
    props: {
      eyebrow: "Engineering quality",
      title: "Audit posture",
      children: <AuditScoreboard items={buildAuditItems()} />,
    },
  },
  {
    id: "whats-next",
    kind: "component",
    props: {
      eyebrow: "Next",
      title: "Milestones ahead",
      children: <NextMilestones />,
    },
  },
  {
    id: "closing",
    kind: "title",
    props: {
      eyebrow: "Thank you",
      title: "Questions and discussion",
      meta: "eip-insight research platform",
    },
  },
];
