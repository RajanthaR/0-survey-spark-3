export type PhaseSlug = "phase-1" | "phase-3";

export type ResearchLang = "en" | "si" | "ta";

export type PublicCount = {
  value: number | null;
  label: string;
  masked: boolean;
};

export type CountSet = {
  all: PublicCount;
  byPhase: Record<PhaseSlug, PublicCount>;
  byLang: Record<ResearchLang, PublicCount>;
};

export type ResearchAggregates = {
  generatedAt: string;
  completed: CountSet;
  started: CountSet;
  inProgress: CountSet;
  lastResponseAgeHours: number | null;
};
