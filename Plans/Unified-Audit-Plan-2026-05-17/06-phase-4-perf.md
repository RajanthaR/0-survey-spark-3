# Phase 4 — Performance & Bundle

## Goal

Lighthouse on `/` and `/s/$slug` is **green** on a mid-tier Android
profile. The respondent JS bundle ships < 200 KB gzipped. Admin charts /
PDF / XLSX never appear on respondent routes.

## Why now

P3 produced split chunks. Now we measure them, set budgets, and gate.

## Sources

- `audits/03-performance.md` (P-1 to P-10)
- `Codex-audits/04-performance-audit.md`

## Codex Sessions

### Session 4.1 — `size-limit` budgets (S, ~1h)

```text
Goal: PRs fail when respondent or admin bundles regress.

Edits:
1. bun add -d size-limit @size-limit/preset-app @size-limit/preset-big-lib
2. .size-limit.json:
   [
     { "name": "respondent / route", "path": "dist/_build/assets/index-*.js",
       "limit": "200 KB", "gzip": true },
     { "name": "respondent /s/$slug", "path": "dist/_build/assets/s.$slug-*.js",
       "limit": "260 KB", "gzip": true },
     { "name": "admin route shell", "path": "dist/_build/assets/admin-*.js",
       "limit": "180 KB", "gzip": true },
     { "name": "admin charts chunk", "path": "dist/_build/assets/admin.charts-*.js",
       "limit": "320 KB", "gzip": true }
   ]
3. Add to pr.yml as a new job that runs after build.

Verification:
- bun run size: prints the budget table.
- A PR that imports recharts into admin shell fails the gate.

Commit: "chore(perf): size-limit budgets in CI".
```

### Session 4.2 — Verify admin-only deps stay out of respondent chunks (S, ~1h)

```text
Goal: Build, then statically prove that recharts / xlsx / jspdf / fflate
do not land in any /s/$slug chunk.

Steps:
1. bun run build
2. bun run size --json | jq to capture chunk graph.
3. For each respondent chunk, assert recharts/xlsx/jspdf/fflate not in
   the dependency list.
4. Add a Vitest spec under src/test/bundle-shape.test.ts that fails if
   the graph regresses.

Commit: "test(perf): assert admin-only deps stay out of respondent bundles".
```

### Session 4.3 — Defer Noto Sans SI/TA fonts until language toggle (S, ~1h)

```text
Goal: EN-only users save ~150 KB of font payload. SI/TA fonts load only
after toggle.

Read:
- src/routes/__root.tsx (font preload section, ~120-145)
- src/styles.css (lang() font-family rules)

Edits:
1. Replace blanket <link rel="preload"> for Sinhala/Tamil with a JS
   helper that injects the link on first language change.
2. Verify FOUT (flash of unstyled text) acceptable on the toggle.
3. If FOUT is too jarring, fall back to <link rel="preload" media>
   syntax keyed off the cookie.

Verification:
- Lighthouse on EN shows < 200 KB respondent chunk.
- Toggle to SI: font loads within 200ms; no layout shift.

Commit: "perf(fonts): defer Sinhala/Tamil until language toggle".
```

### Session 4.4 — Memoize `visibleQuestions` / `progressFor` (S, ~1h)

```text
Goal: SurveyRunner stops recomputing visibility per keystroke.

Read:
- src/lib/survey-logic.ts
- src/components/SurveyRunner.tsx (callsites)

Edits:
1. Add a useMemo wrapper keyed off a hash of (slug, answers).
2. Or: refactor to a `useVisibleQuestions(survey, answers)` hook with
   internal memoization.
3. Add a perf test that asserts the function runs <= N times across a
   simulated keystroke storm.

Commit: "perf(survey): memoize visibility + progress per render".
```

### Session 4.5 — `survey_stats` SQL view + getStats rewrite (M, ~3h)

```text
Goal: getStats becomes a single aggregate query, no 2 000-row cap.

Read:
- src/lib/admin.stats.functions.ts (whole file, focus on getStats)
- audits/03-performance.md P-3 / P-4
- Codex-audits/04-performance-audit.md

Edits:
1. New migration creating a view:
   create view public.survey_stats as
   select survey_slug, language, status,
     count(*) as n,
     count(*) filter (where status = 'completed') as completed,
     count(*) filter (where status = 'in_progress') as in_progress,
     date_trunc('day', started_at) as day
   from public.responses
   group by 1,2,3, day;
2. Rewrite getStats to select from the view + apply filters in SQL.
3. Drop the JS-side aggregation loop.
4. Update tests; record the count delta.

Defer if:
- The 2 000-row cap is not yet a real correctness issue (i.e. response
  volume < 2000). Postpone to P6 backlog and instead add a Sentry
  event when the cap is hit.

Verification:
- bun run test src/lib/__tests__/admin.stats.* passes.
- A 5 000-response fixture returns a correct daily series.

Commit: "perf(stats): SQL aggregate view replaces 2 000-row cap".
```

### Session 4.6 — Lighthouse + axe budgets in CI (S, ~1h)

```text
Goal: Nightly Lighthouse against staging; PR-level axe scan.

Edits:
1. .github/workflows/nightly.yml:
   - Lighthouse against staging URL (LCP < 2.5s, TTI < 3.5s, CLS < 0.1).
   - axe-core full-page on /, /s/phase-1, /admin.
   - npm-audit / bun audit.
2. PR-level axe via @axe-core/playwright on critical paths.

Commit: "ci(perf+a11y): nightly Lighthouse + PR axe scan".
```

## Verification (whole phase)

```sh
bun run build
bun run size                 # all budgets green
bun run smoke                # smoke + Lighthouse against staging
```

## Done criteria

- [ ] 4.1 size-limit budgets in CI.
- [ ] 4.2 Bundle-shape test asserts admin deps stay out of respondent chunks.
- [ ] 4.3 SI/TA fonts deferred.
- [ ] 4.4 Memoization in place.
- [ ] 4.5 SQL aggregate view shipped (or deferred with rationale).
- [ ] 4.6 Lighthouse + axe in CI.
- [ ] Lighthouse on /: LCP < 2.5s, TTI < 3.5s, CLS < 0.1.

## Breaking-change flags

- 4.5 changes the database surface (new view). Run `supabase db push`
  carefully and verify the migration applies cleanly to prod.
- 4.3 changes initial paint behaviour on language toggle (FOUT vs swap).
  Confirm with the human; deferral path is to keep the preloads.
