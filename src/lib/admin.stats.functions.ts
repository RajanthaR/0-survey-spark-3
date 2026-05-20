/**
 * Admin stats / list server functions. Extracted from admin.functions.ts (D21).
 * Helpers (assertAdmin, fillDays) live in admin.shared.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createAdminClient } from "@/integrations/supabase/client.server";
import { SURVEYS } from "@/surveys";
import { sectionBreakdown, isValidCompletedResponse } from "@/lib/survey-logic";
import { pickText } from "@/lib/i18n";
import type { Question } from "@/surveys/types";
import { assertAdmin, fillDays } from "@/lib/admin.shared.server";

function adminClient() {
  return createAdminClient("admin.stats");
}

type StatsInput = {
  surveySlug?: string;
  statusFilter?: "completed" | "in_progress" | "all";
  language?: "en" | "si" | "ta";
  dateFrom?: string;
  dateTo?: string;
};

export type SurveyStatsViewRow = {
  survey_slug: string;
  language: string;
  status: string;
  day: string;
  n: number | string;
  completed: number | string;
  in_progress: number | string;
  duration_ms_sum: number | string;
  duration_count: number | string;
};

type StatsAnswerRow = {
  survey_slug: string;
  language: string;
  answers: unknown;
};

function asCount(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

export function aggregateStatsViewRows(rows: SurveyStatsViewRow[], todayInput = new Date()) {
  const langSplit = new Map<string, number>();
  const surveySplit = new Map<string, number>();
  const dailyMap = new Map<string, number>();
  let total = 0;
  let completed = 0;
  let inProgress = 0;
  let durationSum = 0;
  let durationCount = 0;

  for (const r of rows) {
    const n = asCount(r.n);
    total += n;
    completed += asCount(r.completed);
    inProgress += asCount(r.in_progress);
    durationSum += asCount(r.duration_ms_sum);
    durationCount += asCount(r.duration_count);
    langSplit.set(r.language, (langSplit.get(r.language) ?? 0) + n);
    surveySplit.set(r.survey_slug, (surveySplit.get(r.survey_slug) ?? 0) + n);
    const day = String(r.day ?? "").slice(0, 10);
    if (day) dailyMap.set(day, (dailyMap.get(day) ?? 0) + n);
  }

  const sortedDays = Array.from(dailyMap.keys()).sort();
  const today = new Date(todayInput);
  today.setUTCHours(0, 0, 0, 0);
  const earliest = sortedDays.length ? new Date(`${sortedDays[0]}T00:00:00Z`) : today;
  const minStart = new Date(today);
  minStart.setUTCDate(minStart.getUTCDate() - 13);
  const start = earliest < minStart ? earliest : minStart;
  const daily: { date: string; count: number }[] = [];
  for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    daily.push({ date: key, count: dailyMap.get(key) ?? 0 });
  }

  return {
    total,
    completed,
    inProgress,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
    avgMinutes: durationCount ? Math.round(durationSum / durationCount / 60000) : 0,
    langSplit: Array.from(langSplit, ([name, value]) => ({ name, value })).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    surveySplit: Array.from(surveySplit, ([name, value]) => ({ name, value })).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    daily,
  };
}

async function fetchStatsAnswerRows(data: StatsInput): Promise<StatsAnswerRow[]> {
  if (!data.surveySlug) return [];
  const supabaseAdmin = adminClient();
  const rows: StatsAnswerRow[] = [];
  const PAGE = 1000;

  for (let from = 0; ; from += PAGE) {
    let q = supabaseAdmin
      .from("responses")
      .select("survey_slug, language, answers")
      .order("started_at", { ascending: false })
      .range(from, from + PAGE - 1);
    q = q.eq("survey_slug", data.surveySlug);
    if (data.statusFilter && data.statusFilter !== "all") {
      q = q.eq("status", data.statusFilter);
    }
    if (data.language) q = q.eq("language", data.language);
    if (data.dateFrom) q = q.gte("started_at", `${data.dateFrom}T00:00:00.000Z`);
    if (data.dateTo) q = q.lte("started_at", `${data.dateTo}T23:59:59.999Z`);

    const { data: chunk, error } = await q;
    if (error) throw new Error(error.message);
    const pageRows = (chunk ?? []) as StatsAnswerRow[];
    rows.push(...pageRows);
    if (pageRows.length < PAGE) break;
  }

  return rows;
}

export const getStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: StatsInput) =>
    z
      .object({
        surveySlug: z.string().max(64).optional(),
        statusFilter: z.enum(["completed", "in_progress", "all"]).optional(),
        language: z.enum(["en", "si", "ta"]).optional(),
        dateFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        dateTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = adminClient();
    let statsQ = supabaseAdmin
      .from("survey_stats")
      .select(
        "survey_slug, language, status, day, n, completed, in_progress, duration_ms_sum, duration_count",
      );
    if (data.surveySlug) statsQ = statsQ.eq("survey_slug", data.surveySlug);
    if (data.statusFilter && data.statusFilter !== "all") {
      statsQ = statsQ.eq("status", data.statusFilter);
    }
    if (data.language) statsQ = statsQ.eq("language", data.language);
    if (data.dateFrom) statsQ = statsQ.gte("day", data.dateFrom);
    if (data.dateTo) statsQ = statsQ.lte("day", data.dateTo);
    const { data: statsRows, error } = await statsQ;
    if (error) throw new Error(error.message);
    const summary = aggregateStatsViewRows((statsRows ?? []) as SurveyStatsViewRow[]);
    const detailRows =
      data.surveySlug && SURVEYS[data.surveySlug] ? await fetchStatsAnswerRows(data) : [];

    // Section completion: average % done per section, scoped to a single
    // survey when surveySlug filter is active. Skipped for "all surveys".
    let sectionStats: { name: string; pct: number; total: number; done: number }[] = [];
    if (data.surveySlug && SURVEYS[data.surveySlug] && detailRows.length) {
      const survey = SURVEYS[data.surveySlug];
      const agg = new Map<string, { total: number; done: number }>();
      for (const r of detailRows) {
        const answers = (r.answers ?? {}) as Record<string, unknown>;
        const lang = (r.language as "en" | "si" | "ta") || "en";
        const breakdown = sectionBreakdown(survey, answers, lang);
        for (const s of breakdown) {
          const cur = agg.get(s.name) ?? { total: 0, done: 0 };
          cur.total += s.total;
          cur.done += s.done;
          agg.set(s.name, cur);
        }
      }
      sectionStats = Array.from(agg.entries()).map(([name, v]) => ({
        name,
        total: v.total,
        done: v.done,
        pct: v.total ? Math.round((v.done / v.total) * 100) : 0,
      }));
    }

    // Per-question stats — only meaningful when scoped to a single survey.
    // For each question we report the answered count plus, where applicable,
    // a value distribution (single_choice / multi_choice / likert_5 / yes_no).
    type QStat = {
      id: string;
      label: string;
      type: Question["type"];
      section: string;
      answered: number;
      total: number;
      answeredPct: number;
      distribution?: { name: string; value: number }[];
    };
    let questionStats: QStat[] = [];
    if (data.surveySlug && SURVEYS[data.surveySlug] && detailRows.length) {
      const survey = SURVEYS[data.surveySlug];
      const totalRespondents = detailRows.length;
      questionStats = survey.questions
        .filter((q) => q.type !== "section_header")
        .map((q) => {
          let answered = 0;
          const dist = new Map<string, number>();
          const labelOf = (val: string) => {
            if (q.options) {
              const opt = q.options.find((o) => o.value === val);
              if (opt) return pickText(opt.label, "en");
            }
            return val;
          };
          for (const r of detailRows) {
            const v = (r.answers as Record<string, unknown> | null)?.[q.id];
            if (v == null) continue;
            if (Array.isArray(v)) {
              if (v.length === 0) continue;
              answered += 1;
              if (q.type === "multi_choice") {
                for (const item of v) {
                  const k = String(item);
                  dist.set(labelOf(k), (dist.get(labelOf(k)) ?? 0) + 1);
                }
              }
            } else if (typeof v === "object") {
              if (Object.keys(v as object).length === 0) continue;
              answered += 1;
            } else {
              const s = String(v).trim();
              if (!s) continue;
              answered += 1;
              if (q.type === "single_choice" || q.type === "likert_5" || q.type === "yes_no") {
                dist.set(labelOf(s), (dist.get(labelOf(s)) ?? 0) + 1);
              }
            }
          }
          const distribution =
            dist.size > 0
              ? Array.from(dist.entries())
                  .map(([name, value]) => ({ name, value }))
                  .sort((a, b) => b.value - a.value)
              : undefined;
          return {
            id: q.id,
            label: pickText(q.label, "en"),
            type: q.type,
            section: pickText(q.section, "en"),
            answered,
            total: totalRespondents,
            answeredPct: totalRespondents ? Math.round((answered / totalRespondents) * 100) : 0,
            distribution,
          };
        });
    }

    return {
      total: summary.total,
      completed: summary.completed,
      inProgress: summary.inProgress,
      completionRate: summary.completionRate,
      avgMinutes: summary.avgMinutes,
      langSplit: summary.langSplit,
      surveySplit: summary.surveySplit,
      daily: summary.daily,
      sectionStats,
      questionStats,
    };
  });

export const listResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      surveySlug?: string;
      page?: number;
      pageSize?: number;
      language?: "en" | "si" | "ta";
      dateFrom?: string;
      dateTo?: string;
    }) =>
      z
        .object({
          surveySlug: z.string().max(64).optional(),
          page: z.number().int().min(0).max(10_000).default(0),
          pageSize: z.number().int().min(1).max(200).default(50),
          language: z.enum(["en", "si", "ta"]).optional(),
          dateFrom: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          dateTo: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        })
        .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = adminClient();
    const from = data.page * data.pageSize;
    const to = from + data.pageSize - 1;
    let q = supabaseAdmin
      .from("responses")
      .select(
        "id, survey_slug, language, status, progress_pct, started_at, completed_at, contact",
        {
          count: "exact",
        },
      )
      .order("started_at", { ascending: false })
      .range(from, to);
    if (data.surveySlug) q = q.eq("survey_slug", data.surveySlug);
    if (data.language) q = q.eq("language", data.language);
    if (data.dateFrom) q = q.gte("started_at", `${data.dateFrom}T00:00:00.000Z`);
    if (data.dateTo) q = q.lte("started_at", `${data.dateTo}T23:59:59.999Z`);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return {
      rows: rows ?? [],
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

/**
 * Fetch a single response (answers + survey + language) for the admin
 * detail viewer. The visual summary card on the admin side calls this
 * lazily on row expand — keeps the table list cheap and only pays the
 * round-trip when an analyst actually drills in.
 */
export const getResponseAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = adminClient();
    const { data: row, error } = await supabaseAdmin
      .from("responses")
      .select("id, survey_slug, language, answers")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Response not found");
    const lang = (row.language === "si" || row.language === "ta" ? row.language : "en") as
      | "en"
      | "si"
      | "ta";
    return {
      id: row.id as string,
      surveySlug: row.survey_slug as string,
      language: lang,
      // JSON-stringify so the serverFn serializer doesn't have to map an
      // unknown-valued record across the wire.
      answersJson: JSON.stringify(row.answers ?? {}),
    };
  });

export const previewFilteredCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      surveySlug?: string;
      language?: string;
      dateFrom?: string;
      dateTo?: string;
      dateField?: "started_at" | "completed_at";
      completedOnly?: boolean;
      statusFilter?: "completed" | "in_progress" | "all";
      validOnly?: boolean;
    }) =>
      z
        .object({
          surveySlug: z.string().min(1).max(64).optional(),
          language: z.enum(["en", "si", "ta"]).optional(),
          dateFrom: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          dateTo: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          dateField: z.enum(["started_at", "completed_at"]).default("started_at"),
          completedOnly: z.boolean().default(true),
          statusFilter: z.enum(["completed", "in_progress", "all"]).optional(),
          validOnly: z.boolean().default(false),
        })
        .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    // `validOnly` always implies `completed` regardless of statusFilter.
    // Otherwise, prefer the explicit statusFilter; fall back to the legacy
    // `completedOnly` boolean for older clients that haven't migrated yet.
    const effectiveStatus: "completed" | "in_progress" | "all" = data.validOnly
      ? "completed"
      : (data.statusFilter ?? (data.completedOnly ? "completed" : "all"));
    const dateCol = data.dateField;

    type FilterQuery<T> = T & {
      eq(column: string, value: unknown): FilterQuery<T>;
      gte(column: string, value: string): FilterQuery<T>;
      lte(column: string, value: string): FilterQuery<T>;
    };

    const applyFilters = <T>(q: FilterQuery<T>): FilterQuery<T> => {
      let out = q;
      if (effectiveStatus !== "all") out = out.eq("status", effectiveStatus);
      if (data.surveySlug) out = out.eq("survey_slug", data.surveySlug);
      if (data.language) out = out.eq("language", data.language);
      if (data.dateFrom) out = out.gte(dateCol, `${data.dateFrom}T00:00:00.000Z`);
      if (data.dateTo) out = out.lte(dateCol, `${data.dateTo}T23:59:59.999Z`);
      return out;
    };

    /**
     * Bucket a row into a YYYY-MM-DD UTC key on whichever date field is
     * driving the filter. Rows without the field bucket as `""` (filtered
     * out before charting). Mirrors the date-filter contract above so the
     * timeseries the chart draws maps 1:1 to what the export will emit.
     */
    const dateBucket = (r: {
      started_at?: string | null;
      completed_at?: string | null;
    }): string => {
      const v = dateCol === "completed_at" ? r.completed_at : r.started_at;
      return v ? String(v).slice(0, 10) : "";
    };

    type SampleRow = {
      id: string;
      survey_slug: string;
      language: string;
      status: string;
      started_at: string | null;
      completed_at: string | null;
      contact_name: string;
    };
    const SAMPLE_LIMIT = 5;
    const TIMESERIES_MAX_DAYS = 366;

    // Decide whether the (dateFrom, dateTo) window is small enough to
    // surface as a daily timeseries. We always compute per-day buckets
    // for matched rows we already touch, but we only return them as a
    // contiguous series when the window is bounded and ≤ 366 days, so
    // the chart axis stays readable.
    const inWindow = (() => {
      if (!data.dateFrom || !data.dateTo) return null;
      const from = new Date(`${data.dateFrom}T00:00:00.000Z`);
      const to = new Date(`${data.dateTo}T00:00:00.000Z`);
      const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
      if (days <= 0 || days > TIMESERIES_MAX_DAYS) return null;
      return { from: data.dateFrom, to: data.dateTo, days };
    })();

    const bySurveyMap = new Map<string, number>();
    const byDayMap = new Map<string, number>();
    const byStatusCounts = { completed: 0, in_progress: 0, other: 0 };
    const sample: SampleRow[] = [];
    const supabaseAdmin = adminClient();

    const pushSample = (r: Record<string, unknown>) => {
      if (sample.length >= SAMPLE_LIMIT) return;
      const c = (r.contact ?? {}) as Record<string, unknown>;
      sample.push({
        id: String(r.id ?? ""),
        survey_slug: String(r.survey_slug ?? ""),
        language: String(r.language ?? ""),
        status: String(r.status ?? ""),
        started_at: r.started_at ? String(r.started_at) : null,
        completed_at: r.completed_at ? String(r.completed_at) : null,
        contact_name: String(c.name ?? ""),
      });
    };

    // Fast path: no per-row validation needed. Use one count head query
    // for the total, plus one bounded select for sample + breakdowns.
    if (!data.validOnly) {
      const headBase = supabaseAdmin.from("responses").select("*", { count: "exact", head: true });
      const { count, error: headErr } = await applyFilters(headBase);
      if (headErr) throw new Error(headErr.message);
      const matched = count ?? 0;

      // Exact per-status counts. Cheap when the user has already pinned a
      // single status (skip the extra round-trip), otherwise issue two
      // narrow head queries so the chips stay accurate even when matched
      // exceeds the BREAKDOWN_CAP below.
      if (effectiveStatus === "completed") {
        byStatusCounts.completed = matched;
      } else if (effectiveStatus === "in_progress") {
        byStatusCounts.in_progress = matched;
      } else {
        for (const s of ["completed", "in_progress"] as const) {
          const sBase = supabaseAdmin.from("responses").select("*", { count: "exact", head: true });
          // Apply non-status filters by reusing applyFilters then forcing status.
          const { count: sCount, error: sErr } = await applyFilters(sBase).eq("status", s);
          if (sErr) throw new Error(sErr.message);
          byStatusCounts[s] = sCount ?? 0;
        }
        byStatusCounts.other = Math.max(
          0,
          matched - byStatusCounts.completed - byStatusCounts.in_progress,
        );
      }

      // Bounded fetch for sample + per-survey + per-day breakdowns. Cap
      // at 5000 so the worst case stays cheap; we mark `truncated: true`
      // when the cap is hit so the UI can disclaim the breakdown.
      const BREAKDOWN_CAP = 5000;
      const breakdownBase = supabaseAdmin
        .from("responses")
        .select("id, survey_slug, language, status, started_at, completed_at, contact")
        .order("started_at", { ascending: false })
        .range(0, BREAKDOWN_CAP - 1);
      const { data: rows, error: bErr } = await applyFilters(breakdownBase);
      if (bErr) throw new Error(bErr.message);
      for (const r of (rows ?? []) as Record<string, unknown>[]) {
        const slug = String(r.survey_slug ?? "");
        bySurveyMap.set(slug, (bySurveyMap.get(slug) ?? 0) + 1);
        if (inWindow) {
          const k = dateBucket(r as { started_at?: string | null; completed_at?: string | null });
          if (k) byDayMap.set(k, (byDayMap.get(k) ?? 0) + 1);
        }
        pushSample(r);
      }
      const breakdownTruncated = matched > (rows?.length ?? 0);

      return {
        matched,
        totalFetched: matched,
        droppedInvalid: 0,
        droppedUnknownSurvey: 0,
        bySurvey: Array.from(bySurveyMap, ([slug, count]) => ({ slug, count })).sort(
          (a, b) => b.count - a.count,
        ),
        byStatus: byStatusCounts,
        byDay: inWindow ? fillDays(inWindow.from, inWindow.to, byDayMap) : [],
        sample,
        breakdownTruncated,
        timeseriesAvailable: !!inWindow,
      };
    }

    // Valid-only path: stream the minimum fields needed to evaluate the
    // required-question contract, without building the export rows. We
    // fold breakdown/sample collection into the same loop so a single
    // pass over the rows is enough.
    const PAGE = 500;
    let totalFetched = 0;
    let matched = 0;
    let droppedInvalid = 0;
    let droppedUnknownSurvey = 0;
    for (let page = 0; page < 400; page += 1) {
      const base = supabaseAdmin
        .from("responses")
        .select("id, survey_slug, language, status, started_at, completed_at, contact, answers")
        .order("started_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      const { data: chunk, error } = await applyFilters(base);
      if (error) throw new Error(error.message);
      const rows = (chunk ?? []) as Array<Record<string, unknown>>;
      totalFetched += rows.length;
      for (const r of rows) {
        const slug = String(r.survey_slug ?? "");
        const survey = SURVEYS[slug];
        if (!survey) {
          droppedUnknownSurvey += 1;
          continue;
        }
        const answers = (r.answers ?? {}) as Record<string, unknown>;
        if (isValidCompletedResponse(survey, answers)) {
          matched += 1;
          byStatusCounts.completed += 1;
          bySurveyMap.set(slug, (bySurveyMap.get(slug) ?? 0) + 1);
          if (inWindow) {
            const k = dateBucket(r as { started_at?: string | null; completed_at?: string | null });
            if (k) byDayMap.set(k, (byDayMap.get(k) ?? 0) + 1);
          }
          pushSample(r);
        } else {
          droppedInvalid += 1;
        }
      }
      if (rows.length < PAGE) break;
    }
    return {
      matched,
      totalFetched,
      droppedInvalid,
      droppedUnknownSurvey,
      bySurvey: Array.from(bySurveyMap, ([slug, count]) => ({ slug, count })).sort(
        (a, b) => b.count - a.count,
      ),
      byStatus: byStatusCounts,
      byDay: inWindow ? fillDays(inWindow.from, inWindow.to, byDayMap) : [],
      sample,
      breakdownTruncated: false,
      timeseriesAvailable: !!inWindow,
    };
  });

/**
 * Aggregated analytics report scoped to an optional date range — powers
 * the admin "Download report" panel (CSV + PDF). Returns completion rate,
 * per-question drop-off (only when scoped to a single survey), and
 * language breakdown. Date filter is applied on `started_at`.
 */
export const analyticsReportSchema = z
  .object({
    surveySlug: z.string().min(1).max(64).optional(),
    dateFrom: z
      .string()
      .optional()
      .superRefine((v, ctx) => validateDate(v, ctx, "Start date")),
    dateTo: z
      .string()
      .optional()
      .superRefine((v, ctx) => validateDate(v, ctx, "End date")),
  })
  .superRefine((data, ctx) => {
    const fromSet = !!data.dateFrom;
    const toSet = !!data.dateTo;
    if (fromSet && !toSet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "End date is required when start date is set.",
      });
    }
    if (!fromSet && toSet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateFrom"],
        message: "Start date is required when end date is set.",
      });
    }
    if (fromSet && toSet && data.dateFrom! > data.dateTo!) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateFrom"],
        message: "Start date must be on or before end date.",
      });
    }
    if (fromSet && toSet) {
      const from = new Date(`${data.dateFrom}T00:00:00.000Z`);
      const to = new Date(`${data.dateTo}T00:00:00.000Z`);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
        const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
        if (days > 366) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["dateTo"],
            message: "Date range cannot exceed 366 days.",
          });
        }
      }
    }
  });

function validateDate(v: string | undefined, ctx: z.RefinementCtx, label: string) {
  if (v === undefined) return;
  if (typeof v !== "string" || v.trim() === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${label} is required.`,
    });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${label} must be in YYYY-MM-DD format.`,
    });
    return;
  }
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${label} is not a valid calendar date.`,
    });
  }
}

/**
 * Run the analytics report schema and convert any Zod issues into a
 * `VALIDATION:{...}` Error message. The UI parses that prefix and surfaces
 * the per-field messages inline next to the offending input.
 */
function parseAnalyticsReportInput(d: unknown) {
  const result = analyticsReportSchema.safeParse(d);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  throw new Error(`VALIDATION:${JSON.stringify({ fieldErrors })}`);
}

export const getAnalyticsReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseAnalyticsReportInput)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = adminClient();
    let q = supabaseAdmin
      .from("responses")
      .select("id, survey_slug, language, status, started_at, completed_at, answers");
    if (data.surveySlug) q = q.eq("survey_slug", data.surveySlug);
    if (data.dateFrom) q = q.gte("started_at", `${data.dateFrom}T00:00:00Z`);
    if (data.dateTo) q = q.lte("started_at", `${data.dateTo}T23:59:59Z`);
    const { data: rows, error } = await q.limit(5000);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const total = list.length;
    const completed = list.filter((r) => r.status === "completed").length;
    const inProgress = total - completed;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;

    const langMap: Record<string, number> = {};
    for (const r of list) langMap[r.language] = (langMap[r.language] ?? 0) + 1;
    const byLanguage = Object.entries(langMap)
      .map(([language, count]) => ({
        language,
        count,
        pct: total ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    let dropOff: {
      id: string;
      label: string;
      section: string;
      answered: number;
      total: number;
      answeredPct: number;
      dropOffPct: number;
    }[] = [];
    if (data.surveySlug && SURVEYS[data.surveySlug] && total > 0) {
      const survey = SURVEYS[data.surveySlug];
      dropOff = survey.questions
        .filter((q) => q.type !== "section_header")
        .map((q) => {
          let answered = 0;
          for (const r of list) {
            const v = (r.answers as Record<string, unknown> | null)?.[q.id];
            if (v == null) continue;
            if (Array.isArray(v)) {
              if (v.length > 0) answered += 1;
            } else if (typeof v === "object") {
              if (Object.keys(v as object).length > 0) answered += 1;
            } else if (String(v).trim()) {
              answered += 1;
            }
          }
          const answeredPct = total ? Math.round((answered / total) * 100) : 0;
          return {
            id: q.id,
            label: pickText(q.label, "en"),
            section: pickText(q.section, "en"),
            answered,
            total,
            answeredPct,
            dropOffPct: 100 - answeredPct,
          };
        });
    }

    return {
      generatedAt: new Date().toISOString(),
      surveySlug: data.surveySlug ?? null,
      dateFrom: data.dateFrom ?? null,
      dateTo: data.dateTo ?? null,
      total,
      completed,
      inProgress,
      completionRate,
      byLanguage,
      dropOff,
    };
  });
