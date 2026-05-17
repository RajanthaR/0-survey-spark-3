# P4 Wave-1 — 6 parallel prompts

Fire each `## Prompt N.M` section as a **separate** Codex agent.

**Depends on:** P3 fully merged (3.2 produced the split chunks; 3.3
produced the SurveyRunner hooks).

Conflict matrix — all 6 touch disjoint files:

| Prompt | Owns | Touches |
| --- | --- | --- |
| 4.1 | size-limit budgets | `package.json`, `.size-limit.json`, `pr.yml` |
| 4.2 | bundle-shape test | `src/test/bundle-shape.test.ts` (new) |
| 4.3 | defer SI/TA fonts | `src/routes/__root.tsx`, `src/lib/i18n.tsx` |
| 4.4 | memoize visibility | `src/lib/survey-logic.ts`, hooks from 3.3 |
| 4.5 | survey_stats SQL view | new migration + `admin.stats.functions.ts` |
| 4.6 | Lighthouse + axe in CI | `.github/workflows/nightly.yml` (new) |

---

## Prompt 4.1 — `size-limit` budgets in CI

ROLE: Senior engineer on survey-spark-3. Execute immediately. One PR.

**Goal:** PRs fail when respondent or admin bundles regress.

**Audit ref:** `audits/04-testing.md` T-11.

### TODO

1. `bun add -d size-limit @size-limit/preset-app @size-limit/preset-big-lib`
2. Create `.size-limit.json`:
   ```json
   [
     { "name": "respondent / route", "path": "dist/_build/assets/index-*.js", "limit": "200 KB", "gzip": true },
     { "name": "respondent /s/$slug", "path": "dist/_build/assets/s.$slug-*.js", "limit": "260 KB", "gzip": true },
     { "name": "admin route shell", "path": "dist/_build/assets/admin-*.js", "limit": "180 KB", "gzip": true },
     { "name": "admin charts chunk", "path": "dist/_build/assets/admin.charts-*.js", "limit": "320 KB", "gzip": true }
   ]
   ```
   Verify the file globs against actual built filenames; adjust if
   they differ.
3. Add `"size": "size-limit"` to `package.json`.
4. Add a `size` job to `.github/workflows/pr.yml`, dependent on `build`.
5. README badge for the size job.

### Verification

```bash
bun run build && bun run size            # all budgets green
```

### Commit & PR

- Branch: `perf/size-limit`
- Commit: `chore(perf): size-limit budgets in CI [4.1]`
- PR body refs `audits/04-testing.md` T-11.

---

## Prompt 4.2 — Bundle-shape test (admin deps stay out of respondent)

ROLE: Senior engineer on survey-spark-3. Execute immediately. One PR.

**Goal:** Statically prove that `recharts` / `xlsx` / `jspdf` / `fflate`
do not land in any `/s/$slug` chunk; fail CI if they do.

**Audit ref:** `audits/03-performance.md` P-7.

### TODO

1. After `bun run build`, the dist tree contains `_build/assets/*.js`.
2. Create `src/test/bundle-shape.test.ts` that:
   - Reads each respondent chunk file.
   - For each forbidden dep (`recharts`, `xlsx`, `jspdf`, `fflate`,
     `@fontsource/inter-tight`), grep the file content for the
     `__webpack_require__("…")` style import or the package's
     namespace strings.
   - Fails with a clear message if found.
3. Add this test to the `test` job in CI (after `build`).

### Verification

```bash
bun run build
bun run test src/test/bundle-shape.test.ts
```

### Commit & PR

- Branch: `test/bundle-shape`
- Commit: `test(perf): assert admin-only deps stay out of respondent bundles [4.2]`
- PR body refs `audits/03-performance.md` P-7.

### Stop conditions

- If the test fails on `main` after P3 lands (means the split missed
  something), STOP and report — that's a P3 follow-up, not a test bug.

---

## Prompt 4.3 — Defer SI/TA fonts until language toggle

ROLE: Senior engineer on survey-spark-3. Execute immediately. One PR.

**Goal:** EN-only users save ~150 KB of font payload. Sinhala/Tamil
fonts only load after the language toggle.

**Audit ref:** `audits/03-performance.md` P-6.

⚠ **FOUT decision** — flag in PR body.

### TODO

1. Read first:
   - `src/routes/__root.tsx` (font preload section, ~120-145)
   - `src/styles.css` (`:lang(si)` / `:lang(ta)` font-family rules)
2. Replace the blanket `<link rel="preload">` for Sinhala/Tamil with a
   JS helper that injects the link the first time the language changes
   to SI or TA. Pseudocode:
   ```ts
   function ensureFont(lang: "si" | "ta") {
     if (document.querySelector(`link[data-font="${lang}"]`)) return;
     const link = document.createElement("link");
     link.rel = "stylesheet";
     link.href = lang === "si" ? "<si-fonts.css>" : "<ta-fonts.css>";
     link.dataset.font = lang;
     document.head.append(link);
   }
   ```
3. Hook into the language toggle. Also call once on initial render if
   the cookie/persisted lang is already SI or TA.
4. If FOUT is too jarring on initial render (because of the SSR
   `<html lang>` from 2.5), keep an unconditional `<link rel="preload"
   as="font" type="font/woff2" media="(lang: si)">` for SI font and a
   `(lang: ta)` for TA. Verify the browser respects `media`.
5. Document the decision in the PR body.

### Verification

```bash
bun run build
bun run size                         # respondent / route < 200 KB
# Lighthouse on / in EN — record LCP / FCP.
# Toggle to SI — record font load time + layout shift.
```

### Commit & PR

- Branch: `perf/defer-si-ta-fonts`
- Commit: `perf(fonts): defer Sinhala/Tamil until language toggle [4.3]`
- PR body refs `audits/03-performance.md` P-6 and reports the budget
  delta + FOUT decision.

---

## Prompt 4.4 — Memoize `visibleQuestions` / `progressFor`

ROLE: Senior engineer on survey-spark-3. Execute immediately. One PR.

**Goal:** SurveyRunner stops recomputing visibility per keystroke.

**Audit ref:** `audits/03-performance.md` P-8.

### TODO

1. Read first:
   - `src/lib/survey-logic.ts` — `visibleQuestions`, `progressFor`
   - `src/components/survey/hooks/useStageMachine.ts` (from 3.3) —
     call sites
2. Wrap the heavy computations in `useMemo` inside the hook, keyed off
   a stable hash of `(slug, JSON.stringify(answers))`. If `answers` is
   already deeply-structurally-stable, key off `answers` directly.
3. Add a perf-shape test under `src/lib/__tests__/visibility-memo.test.ts`
   that:
   - Mounts a small harness that calls the hook with the same answers
     twice.
   - Asserts the heavy function ran once, not twice (use a counting
     wrapper around the impl).

### Verification

```bash
bun run typecheck
bun run test
```

### Commit & PR

- Branch: `perf/memoize-visibility`
- Commit: `perf(survey): memoize visibility + progress per render [4.4]`
- PR body refs `audits/03-performance.md` P-8.

---

## Prompt 4.5 — `survey_stats` SQL view + getStats rewrite

ROLE: Senior engineer on survey-spark-3. Execute immediately. One PR.

**Goal:** `getStats` becomes a single aggregate query against a SQL
view; the 2 000-row cap goes away.

**Audit ref:** `audits/03-performance.md` P-3 / P-4.

⚠ **MIGRATION** — additive view, no destructive change.

### TODO

1. Read first:
   - `src/lib/admin.stats.functions.ts` — `getStats` (and any other
     stats function that caps rows).
   - `db/schema.sql` — `responses` table shape.
2. New migration `supabase/migrations/<ts>_survey_stats_view.sql`:
   ```sql
   create or replace view public.survey_stats as
   select
     survey_slug,
     language,
     status,
     date_trunc('day', started_at) as day,
     count(*) as n,
     count(*) filter (where status = 'completed') as completed,
     count(*) filter (where status = 'in_progress') as in_progress
   from public.responses
   group by 1, 2, 3, day;

   grant select on public.survey_stats to authenticated;
   ```
3. Rewrite `getStats` to select from the view + apply filters in SQL.
   Drop the JS-side aggregation loop.
4. Re-generate `src/integrations/supabase/types.ts` if necessary.
5. Verify behaviour: existing tests must pass with the rewritten
   function returning the same shape.

### Verification

```bash
supabase db push --include-all       # local
bun run typecheck
bun run test src/lib/__tests__/admin.stats
# Seeded test: 5 000 responses → daily series returns correctly.
```

### Commit & PR

- Branch: `perf/survey-stats-view`
- Commit: `perf(stats): SQL aggregate view replaces row-cap aggregation [4.5]`
- PR body refs `audits/03-performance.md` P-3 / P-4.

### Stop conditions

- If `getStats` is the source of >1 admin chart and the shapes diverge,
  shape the view to match the highest-fidelity caller and update the
  others to consume the new shape.
- If response volume in the seeded test is <100, you cannot prove the
  cap removal — note this in the PR body.

---

## Prompt 4.6 — Lighthouse + axe-core in CI

ROLE: Senior engineer on survey-spark-3. Execute immediately. One PR.

**Goal:** Nightly Lighthouse against staging; PR-level axe scan against
critical routes.

**Audit ref:** `audits/10-other.md` O-1.

### TODO

1. Create `.github/workflows/nightly.yml`:
   - Schedule: `cron: "0 3 * * *"` (UTC).
   - Steps:
     - install + build
     - boot preview
     - Lighthouse against `/`, `/s/phase-1`, `/admin` — assert LCP <
       2.5s, TTI < 3.5s, CLS < 0.1
     - axe-core full-page on the same routes — 0 serious violations
     - `bun audit` (or skipped with a note if Bun audit is unstable)
   - Upload artifacts (lighthouse JSON, axe report).
2. Add a PR-level axe job in `pr.yml` that runs against the **build
   preview** only on `/` and `/s/phase-1` (skip `/admin` because it
   needs auth).
3. Add badges to `README.md`.

### Verification

```bash
# Cannot fully run nightly locally; verify config syntactically:
bunx --bun yaml-lint .github/workflows/nightly.yml
# Run a probe of the PR axe job locally:
bun run build && bun run preview &
sleep 2
bunx --bun @axe-core/cli http://localhost:5173/ --exit
kill %1
```

### Commit & PR

- Branch: `ci/lighthouse-axe`
- Commit: `ci(perf+a11y): nightly Lighthouse + PR axe scan [4.6]`
- PR body refs `audits/10-other.md` O-1.

### Stop conditions

- If `@axe-core/cli` is unavailable in Bun environment, use the
  Playwright-based `@axe-core/playwright` runner via Vitest instead.
