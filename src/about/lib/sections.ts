export type AboutSectionId = "study" | "research" | "engineering" | "present";

export type AboutSection = {
  id: AboutSectionId;
  laneNumber: number;
  label: string;
  title: string;
  description: string;
  path: `/about/${AboutSectionId}`;
  planPath: string;
};

export const ABOUT_SECTIONS = [
  {
    id: "study",
    laneNumber: 1,
    label: "Study",
    title: "Study lane",
    description: "Participant-facing context, consent, survey scope, and research purpose.",
    path: "/about/study",
    planPath: "Plans/InApp-Explorer-2026-05-26/02-study-lane.md",
  },
  {
    id: "research",
    laneNumber: 2,
    label: "Research",
    title: "Research lane",
    description: "Narrative evidence, design rationale, and research-method notes.",
    path: "/about/research",
    planPath: "Plans/InApp-Explorer-2026-05-26/03-research-lane.md",
  },
  {
    id: "engineering",
    laneNumber: 3,
    label: "Engineering",
    title: "Engineering lane",
    description: "Architecture, audits, runbooks, and implementation traceability.",
    path: "/about/engineering",
    planPath: "Plans/InApp-Explorer-2026-05-26/04-engineering-lane.md",
  },
  {
    id: "present",
    laneNumber: 4,
    label: "Present",
    title: "Presentation lane",
    description: "Reusable presentation views assembled from the other explorer lanes.",
    path: "/about/present",
    planPath: "Plans/InApp-Explorer-2026-05-26/05-presentation-lane.md",
  },
] as const satisfies readonly AboutSection[];

export function getAboutSection(id: AboutSectionId): AboutSection {
  return ABOUT_SECTIONS.find((section) => section.id === id)!;
}

export function getAboutSectionForPath(pathname: string): AboutSection | undefined {
  return ABOUT_SECTIONS.find((section) => pathname === section.path);
}
