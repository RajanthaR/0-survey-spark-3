/**
 * Pure detector for live admin alerts.
 *
 * Given a previous and current "snapshot" of the dashboard, emit alerts
 * when the completion rate suddenly drops, or when an individual question
 * shows an unusual spike in skipped / empty responses. The function is
 * deterministic and side-effect-free so it can be unit-tested without
 * mounting React.
 */

export type AlertSeverity = "warning" | "critical";

export interface CompletionDropAlert {
  kind: "completion_drop";
  id: string;
  severity: AlertSeverity;
  at: number;
  prevPct: number;
  curPct: number;
  deltaPp: number;
}

export interface SkipSpikeAlert {
  kind: "skip_spike";
  id: string;
  severity: AlertSeverity;
  at: number;
  questionId: string;
  questionLabel: string;
  prevAnsweredPct: number;
  curAnsweredPct: number;
  deltaPp: number;
  curSkippedPct: number;
}

export type AdminAlert = CompletionDropAlert | SkipSpikeAlert;

export interface QuestionSnap {
  id: string;
  label: string;
  answeredPct: number;
  total: number;
}

export interface AlertSnapshot {
  surveySlug: string;
  total: number;
  completionRate: number;
  questions: QuestionSnap[];
}

export interface DetectOptions {
  /** Min pp drop in completion rate to surface a warning. */
  completionDropPp?: number;
  /** Min pp drop in answered-rate per question to surface a warning. */
  skipSpikePp?: number;
  /** Pp size at which an alert is upgraded to "critical". */
  criticalPp?: number;
  /** Min total responses before completion-rate deltas are trusted. */
  minResponses?: number;
  /** Min per-question sample before skip-spike deltas are trusted. */
  minQuestionSample?: number;
  /** Absolute skipped-% threshold that fires even without a prior delta. */
  absoluteSkipPct?: number;
  /** Injected clock for tests. Defaults to Date.now(). */
  now?: number;
}

const DEFAULTS: Required<Omit<DetectOptions, "now">> = {
  completionDropPp: 10,
  skipSpikePp: 15,
  criticalPp: 25,
  minResponses: 5,
  minQuestionSample: 5,
  absoluteSkipPct: 60,
};

/**
 * Detect alerts triggered by the transition from `prev` to `cur`. Returns
 * an empty array on the first snapshot (no baseline) or when the survey
 * slug changes (different denominator — comparisons would be misleading).
 */
export function detectAlerts(
  prev: AlertSnapshot | null,
  cur: AlertSnapshot,
  opts: DetectOptions = {},
): AdminAlert[] {
  const o = { ...DEFAULTS, ...opts };
  const now = opts.now ?? Date.now();
  if (!prev) return [];
  if (prev.surveySlug !== cur.surveySlug) return [];

  const out: AdminAlert[] = [];

  // Completion-rate drop
  if (cur.total >= o.minResponses && prev.total >= o.minResponses) {
    const delta = prev.completionRate - cur.completionRate;
    if (delta >= o.completionDropPp) {
      out.push({
        kind: "completion_drop",
        id: `completion_drop:${cur.surveySlug}:${now}`,
        severity: delta >= o.criticalPp ? "critical" : "warning",
        at: now,
        prevPct: prev.completionRate,
        curPct: cur.completionRate,
        deltaPp: Math.round(delta * 10) / 10,
      });
    }
  }

  // Per-question skip spike
  const prevById = new Map(prev.questions.map((q) => [q.id, q]));
  for (const q of cur.questions) {
    if (q.total < o.minQuestionSample) continue;
    const before = prevById.get(q.id);
    const skippedPct = Math.max(0, 100 - q.answeredPct);

    if (before && before.total >= o.minQuestionSample) {
      const delta = before.answeredPct - q.answeredPct;
      if (delta >= o.skipSpikePp) {
        out.push({
          kind: "skip_spike",
          id: `skip_spike:${cur.surveySlug}:${q.id}:${now}`,
          severity: delta >= o.criticalPp ? "critical" : "warning",
          at: now,
          questionId: q.id,
          questionLabel: q.label,
          prevAnsweredPct: before.answeredPct,
          curAnsweredPct: q.answeredPct,
          deltaPp: Math.round(delta * 10) / 10,
          curSkippedPct: skippedPct,
        });
        continue;
      }
    }

    // Absolute skip threshold — catches questions that start out bad
    // (no prior baseline to diff against) once they have enough samples.
    if (!before && skippedPct >= o.absoluteSkipPct) {
      out.push({
        kind: "skip_spike",
        id: `skip_spike:${cur.surveySlug}:${q.id}:${now}`,
        severity: skippedPct >= o.absoluteSkipPct + o.criticalPp ? "critical" : "warning",
        at: now,
        questionId: q.id,
        questionLabel: q.label,
        prevAnsweredPct: q.answeredPct,
        curAnsweredPct: q.answeredPct,
        deltaPp: 0,
        curSkippedPct: skippedPct,
      });
    }
  }

  return out;
}
