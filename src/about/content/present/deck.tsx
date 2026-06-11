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
import { SURVEY_LIST } from "@/surveys";

import architectureOverviewSource from "@/about/diagrams/architecture-overview.mmd?raw";
import i18nPipelineSource from "@/about/diagrams/i18n-pipeline.mmd?raw";
import surveyWritePathSource from "@/about/diagrams/survey-write-path.mmd?raw";
import milestonesSource from "@/about/content/research/milestones.json?raw";

function phaseOnly(slug: PhaseTimelineItem["slug"]): PhaseTimelineItem[] {
  return buildPhaseTimelineItems().filter((phase) => phase.slug === slug);
}

function DeckStats() {
  const totalQuestions = SURVEY_LIST.reduce((sum, survey) => sum + survey.questions.length, 0);
  const minutes = SURVEY_LIST.map((survey) => survey.estimatedMinutes);
  const stats = [
    { value: String(SURVEY_LIST.length), label: "survey phases live today" },
    { value: String(totalQuestions), label: "questions across both instruments" },
    { value: "3", label: "languages on every screen" },
    { value: `${Math.min(...minutes)}–${Math.max(...minutes)}`, label: "minutes per response" },
  ];

  return (
    <div className="grid h-full content-center gap-5 sm:grid-cols-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-3xl border bg-background p-8 text-center shadow-soft"
        >
          <p className="stat-tile-number font-display text-5xl font-semibold text-primary lg:text-6xl">
            {stat.value}
          </p>
          <p className="mt-3 text-xl text-muted-foreground lg:text-2xl">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

function NextMilestones() {
  const milestones = parseMilestones(milestonesSource)
    .filter((milestone) => milestone.status !== "done")
    .slice(0, 4);

  return (
    <ol className="grid h-full content-center gap-4 text-2xl lg:text-3xl">
      {milestones.map((milestone, index) => (
        <li
          key={`${milestone.date}-${milestone.label}`}
          className="flex items-center gap-6 rounded-2xl border bg-background p-6"
        >
          <span
            aria-hidden="true"
            className="font-display text-4xl font-semibold leading-none text-primary/30 lg:text-5xl"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{milestone.label}</p>
            <p className="mt-2 text-lg uppercase tracking-[0.2em] text-primary">
              {milestone.date}
              {milestone.status === "in-progress" && (
                <span className="ml-4 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium normal-case tracking-normal text-primary">
                  in progress
                </span>
              )}
            </p>
          </div>
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
      meta: "University of Sri Jayewardenepura - 2026",
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
    id: "by-the-numbers",
    kind: "component",
    props: {
      eyebrow: "At a glance",
      title: "The study by the numbers",
      children: <DeckStats />,
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
    id: "trilingual-by-design",
    kind: "text",
    props: {
      eyebrow: "Trilingual by design",
      text: "Every question, consent item, and result label ships in English, Sinhala, and Tamil — respondents answer in their own language and can switch at any point.",
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
    id: "anonymity-by-design",
    kind: "text",
    props: {
      eyebrow: "Ethics & anonymity",
      text: "Participation is voluntary and anonymous by default — contact details are optional, and aggregate counts below 10 stay masked.",
      supportingText: "Ethics clearance: ERC-HSS, University of Sri Jayewardenepura.",
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
