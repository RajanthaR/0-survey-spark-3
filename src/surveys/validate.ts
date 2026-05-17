import type { Option, Question, Survey } from "./types";

/**
 * Per-question invariant: an `options[]` array is "all visual or none".
 *
 * The renderer relies on this — if some options had art and others didn't, the
 * UI would either look broken (random gaps) or silently drop the visual slot
 * for whole questions. Catching it at survey-load time turns a class of UX
 * bugs into a hard, easy-to-locate error.
 */
export function findVisualInvariantViolations(survey: Survey): string[] {
  const errors: string[] = [];
  for (const q of survey.questions) {
    const opts = q.options;
    if (!opts || opts.length === 0) continue;
    const withIdx: number[] = [];
    const withoutIdx: number[] = [];
    opts.forEach((o, i) => (o.visual ? withIdx : withoutIdx).push(i));
    if (withIdx.length !== 0 && withoutIdx.length !== 0) {
      const fmt = (idxs: number[]) => idxs.map((i) => `#${i} "${opts[i].value}"`).join(", ");
      errors.push(
        `[${survey.slug}] Question "${q.id}" mixes options with and without visuals ` +
          `(${withIdx.length}/${opts.length} have a visual). ` +
          `Add a \`visual\` to: ${fmt(withoutIdx)} — or remove it from: ${fmt(withIdx)}. ` +
          `Per-question rule: all options opt in, or none do.`,
      );
    }
  }
  return errors;
}

/**
 * Convenience for the `OptionVisual` component: which visual (if any) does
 * the renderer ship for this question? Returns the visual slot mode so callers
 * can reserve layout space consistently across all options.
 */
export function questionHasVisuals(opts: Option[] | undefined): boolean {
  return Boolean(opts && opts.length > 0 && opts.every((o) => o.visual));
}

export function assertSurveyVisualInvariants(surveys: Survey[]): void {
  const all = surveys.flatMap(findVisualInvariantViolations);
  if (all.length === 0) return;
  const message = `Survey visual invariant violations:\n  - ${all.join("\n  - ")}`;
  // In dev builds, fail loudly so the offending survey is impossible to ship.
  // In prod, log and continue so a single bad option block can't black-out
  // the whole survey runner.
  if (import.meta.env?.DEV) {
    throw new Error(message);
  }
  console.error(message);
}
