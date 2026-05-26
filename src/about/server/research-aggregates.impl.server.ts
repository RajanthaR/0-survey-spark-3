import { createAdminClient } from "@/integrations/supabase/client.server";
import type {
  CountSet,
  PhaseSlug,
  PublicCount,
  ResearchAggregates,
  ResearchLang,
} from "@/about/server/research-aggregates.types";

const PHASE_SLUGS = ["phase-1", "phase-3"] as const;
const LANGS = ["en", "si", "ta"] as const;
const MASK_THRESHOLD = 10;

type SurveyStatsRow = {
  survey_slug: string | null;
  language: string | null;
  n: number | string | null;
  completed: number | string | null;
  in_progress: number | string | null;
};

type LatestResponseRow = {
  started_at: string | null;
};

type MutableCountSet = {
  all: number;
  byPhase: Record<PhaseSlug, number>;
  byLang: Record<ResearchLang, number>;
};

function researchClient() {
  return createAdminClient("about.researchAggregates");
}

function emptyMutableCountSet(): MutableCountSet {
  return {
    all: 0,
    byPhase: { "phase-1": 0, "phase-3": 0 },
    byLang: { en: 0, si: 0, ta: 0 },
  };
}

function asCount(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function maskCount(count: number): PublicCount {
  if (count < MASK_THRESHOLD) {
    return { value: null, label: "<10", masked: true };
  }

  return { value: count, label: String(count), masked: false };
}

function finalizeCountSet(counts: MutableCountSet): CountSet {
  return {
    all: maskCount(counts.all),
    byPhase: {
      "phase-1": maskCount(counts.byPhase["phase-1"]),
      "phase-3": maskCount(counts.byPhase["phase-3"]),
    },
    byLang: {
      en: maskCount(counts.byLang.en),
      si: maskCount(counts.byLang.si),
      ta: maskCount(counts.byLang.ta),
    },
  };
}

function addCount(
  counts: MutableCountSet,
  row: Pick<SurveyStatsRow, "survey_slug" | "language">,
  amount: number,
) {
  if (amount <= 0) return;

  counts.all += amount;

  if (row.survey_slug === "phase-1" || row.survey_slug === "phase-3") {
    counts.byPhase[row.survey_slug] += amount;
  }

  if (row.language === "en" || row.language === "si" || row.language === "ta") {
    counts.byLang[row.language] += amount;
  }
}

export function buildResearchAggregates(
  statsRows: SurveyStatsRow[],
  latestResponse: LatestResponseRow | null,
  now = new Date(),
): ResearchAggregates {
  const completed = emptyMutableCountSet();
  const started = emptyMutableCountSet();
  const inProgress = emptyMutableCountSet();

  for (const row of statsRows) {
    addCount(started, row, asCount(row.n));
    addCount(completed, row, asCount(row.completed));
    addCount(inProgress, row, asCount(row.in_progress));
  }

  let lastResponseAgeHours: number | null = null;
  if (latestResponse?.started_at) {
    const startedAt = new Date(latestResponse.started_at).getTime();
    if (!Number.isNaN(startedAt)) {
      lastResponseAgeHours = Math.max(0, Math.floor((now.getTime() - startedAt) / 3_600_000));
    }
  }

  return {
    generatedAt: now.toISOString(),
    completed: finalizeCountSet(completed),
    started: finalizeCountSet(started),
    inProgress: finalizeCountSet(inProgress),
    lastResponseAgeHours,
  };
}

export async function getResearchAggregates(now = new Date()): Promise<ResearchAggregates> {
  const supabaseAdmin = researchClient();

  const { data: statsRows, error: statsError } = await supabaseAdmin
    .from("survey_stats")
    .select("survey_slug, language, n, completed, in_progress")
    .in("survey_slug", [...PHASE_SLUGS]);

  if (statsError) throw new Error(statsError.message);

  const { data: latestResponse, error: latestError } = await supabaseAdmin
    .from("responses")
    .select("started_at")
    .in("survey_slug", [...PHASE_SLUGS])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw new Error(latestError.message);

  return buildResearchAggregates(
    (statsRows ?? []) as SurveyStatsRow[],
    (latestResponse ?? null) as LatestResponseRow | null,
    now,
  );
}
