# Unified Master TODO

Single ordered checklist. Each row maps to one Codex Session in a phase
file. Tick `[x]` as you ship; if a row is blocked, tick `[~]` and add a
comment.

> **Cadence:** P0 + P1 in week 1. P2 in week 2. P3 over weeks 3-4. P4-P6
> over weeks 5-7. The deferred catalogue (`09-deferred-breaking.md`)
> revisits in week 8.

## Phase 0 — Tooling Baseline

- [ ] **0.1** Reproducible install + scripts — `02-phase-0-tooling.md`
- [ ] **0.2** Auto-format pass (Prettier) — `02-phase-0-tooling.md`
- [ ] **0.3** CI gate workflow `pr.yml` — `02-phase-0-tooling.md`
- [ ] **0.4** Pre-commit hook (husky + lint-staged) — `02-phase-0-tooling.md`

## Phase 1 — Bug fixes & test stabilisation

- [ ] **1.1** Fix `react-hooks/rules-of-hooks` in `FilteredPreviewExtras.tsx` — Q-1
- [ ] **1.2** **HIGH** Fix `adminLoginGuard` lockout — S-15
- [ ] **1.3** Reconcile SurveyRunner motion / announcement tests — T-2 / T-3
- [ ] **1.4** Unit-test Turnstile guard without Start runtime — T-1
- [ ] **1.5** Restore codebook XLSX freeze pane — T-5
- [ ] **1.6** Move 5 inline SI/TA literals into dictionaries — C-2 / I-2
- [ ] **1.7** Stale TA-TODO comments + dictionary parity test — C-1 / I-3 / I-1
- [ ] **1.8** Resolve SurveyRunner `exhaustive-deps` warning — Q-2
- [ ] **1.9** Drop unused eslint-disable directives — Q-5

## Phase 2 — Security & privacy

- [ ] **2.1** Production Turnstile fail-closed — S-1
- [ ] **2.2** Resume token out of URL bar — U-3 / S-7  ⚠ behaviour change
- [ ] **2.3** HSTS + Permissions-Policy + Referrer-Policy — S-6
- [ ] **2.4** Durable Object rate limiter — S-3  ⚠ infra cost
- [ ] **2.5** CSP nonce on `script-src` — S-16  ⚠ partial (style-src defer)
- [ ] **2.6** Audit-logged `supabaseAdmin` factory — DB-7
- [ ] **2.7** Stale-row cron — S-13

## Phase 3 — Architecture (refactor)

- [ ] **3.1** Pre-refactor screenshots baseline
- [ ] **3.2** **XL** Split `admin.tsx` (4 099 → 200 lines) — A-2 / P-1  ⚠ deep-link change risk
- [ ] **3.3** Extract SurveyRunner hooks — A-1
- [ ] **3.4** Type Supabase filter chain (drop `as any`) — Q-4
- [ ] **3.5** De-dup `isAnswered` — A-4
- [ ] **3.6** Move admin pure functions under `src/lib/admin/` — A-5
- [ ] **3.7** Tighten `LocalizedString` typing — A-10
- [ ] **3.8** ARCHITECTURE.md

## Phase 4 — Performance & bundle

- [ ] **4.1** `size-limit` budgets in CI — T-11
- [ ] **4.2** Bundle-shape test (admin deps stay out of respondent) — P-7
- [ ] **4.3** Defer SI/TA fonts until language toggle — P-6  ⚠ FOUT decision
- [ ] **4.4** Memoize `visibleQuestions` / `progressFor` — P-8
- [ ] **4.5** `survey_stats` SQL view + getStats rewrite — P-3 / P-4  ⚠ migration
- [ ] **4.6** Lighthouse + axe-core in CI — O-1

## Phase 5 — UX, a11y, i18n polish

- [ ] **5.1** Skip-link + visible Back label — U-1 / U-4
- [ ] **5.2** Localise 404 / 500 / not-found — U-11 / I-5
- [ ] **5.3** `<html lang>` + intro parity + researcher CTA — U-2 / I-4 / C-4 / I-6
- [ ] **5.4** Auto-advance UX tuning — U-5
- [ ] **5.5** Likert aria-label richness — U-8 / I-7
- [ ] **5.6** Same-as-English review report — S-18
- [ ] **5.7** `pickText` misses gate CI — S-17  ⚠ may surface many fallbacks
- [ ] **5.8** Error rendering policy + apply — U-7
- [ ] **5.9** Manual a11y sweep with VoiceOver

## Phase 6 — Deployment, docs, observability

- [ ] **6.1** Deploy preflight script — DB-3
- [ ] **6.2** RESEARCHER_OPS.md — W-1
- [ ] **6.3** ADMIN_ONBOARDING.md — W-7
- [ ] **6.4** CONTRIBUTING + SECURITY + LICENSE — O-8 / O-9 / O-16
- [ ] **6.5** Structured logger + Sentry — O-3 / O-4  ⚠ data residency
- [ ] **6.6** CF Analytics Engine events — O-5
- [ ] **6.7** Schema drift policy + nightly check — DB-1
- [ ] **6.8** RLS deny-by-default migration — S-8 / DB-2  ⚠ migration risk
- [ ] **6.9** Backup / restore runbook — DB-8
- [ ] **6.10** Update DEPLOYMENT.md — DB-3 / DB-9 / S-12

## Deferred (do NOT ship without explicit go-ahead)

See `09-deferred-breaking.md` for full rationale and triggers.

- [ ] **D-1** Major dependency upgrades (Vite 8, ESLint 10, TS 6, Vitest 4 stable, Recharts 3, Zod 4)
- [ ] **D-2** Resume token UX migration window
- [ ] **D-3** Database schema migrations beyond P4.5
- [ ] **D-4** Postgres-direct migration off Supabase
- [ ] **D-5** Deploy target change (away from CF Workers)
- [ ] **D-6** Tailwind v5
- [ ] **D-7** `xlsx` → `exceljs`
- [ ] **D-8** `@tanstack/react-query` removal
- [ ] **D-9** Full `sectionBreakdown` SQL rewrite
- [ ] **D-10** `routeTree.gen.ts` policy change
- [ ] **D-11** CSP `style-src` no-`'unsafe-inline'`
- [ ] **D-12** Service worker precache rewrite
- [ ] **D-13** `framer-motion` → `motion` rename

## Quick stats per phase (effort estimate)

| Phase | Sessions | Total est. | Risk |
| --- | --- | --- | --- |
| P0 | 4 | ~4 h | Low |
| P1 | 9 | ~10 h | Low (one critical: 1.2) |
| P2 | 7 | ~13 h | Medium (URL change + DO infra) |
| P3 | 8 | ~3 d | High (admin.tsx split) |
| P4 | 6 | ~9 h | Low–medium |
| P5 | 9 | ~10 h | Low |
| P6 | 10 | ~13 h | Medium (Sentry data residency) |

## What "done" looks like (acceptance)

```
✔ bun run typecheck && bun run lint && bun run test all green in CI
✔ size-limit budgets green; admin chunks lazy
✔ Lighthouse: a11y >= 95, perf >= 85 on / and /s/$slug
✔ axe-core: 0 serious violations
✔ securityheaders.com: A or A+ on staging
✔ adminLoginGuard locks out per spec (test asserts)
✔ Turnstile fails closed in production
✔ <html lang> server-rendered correctly
✔ Sentry shows zero unhandled errors after a smoke run
✔ docs/{TROUBLESHOOTING,RESEARCHER_OPS,ADMIN_ONBOARDING,DEPLOYMENT,
  ARCHITECTURE,CONTRIBUTING,SECURITY,OBSERVABILITY,BACKUP_RESTORE,UX-PATTERNS}.md
  all exist and link from README
```
