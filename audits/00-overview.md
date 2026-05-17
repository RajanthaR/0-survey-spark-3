# Comprehensive Audit — Overview

**Audit date:** 2026-05-17
**Scope:** Full-stack audit of `survey-spark-3`, a trilingual research survey
runner + admin analytics dashboard.
**Tech stack:** TanStack Start v1 + React 19, Vite 7, Tailwind v4, Radix UI,
Supabase (Postgres + Auth), Cloudflare Workers (via Wrangler), Vitest +
Playwright.

## How the audit is organised

| File | Topic |
| --- | --- |
| `01-content.md` | Survey copy, UI strings, translations |
| `02-uiux.md` | Visual design, accessibility, respondent flow |
| `03-performance.md` | Bundle size, runtime, queries, SSR cold path |
| `04-testing.md` | Unit / e2e coverage, failing tests, gaps |
| `05-architecture.md` | Module boundaries, separation of concerns |
| `06-code-quality.md` | Lint, types, complexity, dead code |
| `07-security.md` | Auth, RLS, secrets, headers, bot defence |
| `08-i18n.md` | EN / SI / TA dictionary coverage + runtime |
| `09-tech-stack.md` | Dependency hygiene, build, deploy targets |
| `10-other.md` | DX, docs, CI/CD, observability, licensing |
| `11-database-deployment.md` | Supabase migrations, schema drift, deploy preflight |
| `12-product-admin-workflows.md` | Researcher journey + admin task hierarchy |
| `13-codex-parity-supplement.md` | Findings I missed in 00–10 (vs. `Codex-audits/`) + corrections |
| `99-master-todo.md` | Phased execution plan compiled from all audits |

## Health snapshot

| Area | Status | Headline finding |
| --- | --- | --- |
| Security | � Stronger than my first read | Turnstile + rate limit + RLS + CSP (with `'unsafe-inline'`) are present. `adminLoginGuard` is **broken** (two independent buckets — see `13-codex-parity-supplement.md` S-15). Turnstile fails open without `TURNSTILE_SECRET`. HSTS / Referrer-Policy / Permissions-Policy headers still missing. |
| Architecture | 🟠 Mixed | Server-fn split + barrel re-exports are good; `admin.tsx` (4 099 lines) and `SurveyRunner.tsx` (878 lines) are still monoliths |
| Code quality | 🟠 Needs work | TS strict passes, but ESLint reports **1 949** problems (1 865 auto-fixable Prettier + **1 react-hooks/rules-of-hooks bug** + 8 `no-explicit-any` + 52 inline-Sinhala/Tamil violations) |
| Testing | 🔴 Broken on `main` | `bun run test` → **51 failing / 483 passing**. ~30 failures are post-refactor regressions in the `SurveyRunner` motion + announcement contracts; 9 are TanStack Start `AsyncLocalStorage` plumbing in unit tests; 3 are i18n guardrail tests catching real leaks. |
| i18n | 🟠 Almost complete | All survey questions translated to EN / SI / TA; UI dictionary has one missing SI or TA string (67 EN vs 66 SI / TA). 5 inline SI/TA literals leak outside dictionaries. Stale `TA = TODO` doc comments in `phase-1.ts` / `phase-3.ts`. |
| Performance | 🟠 Mixed | Good: SW cache for option images, debounced autosave, `sendBeacon` flush, prefetch, streaming admin exports with CRC32. Risk: in-memory rate-limit/cache won't survive Worker restarts; admin route ships heavy charts bundle eagerly via `import.meta.env`; `dedupe` + first paint reads localStorage in a sync `<script>`. |
| Tech stack | 🟢 Modern | React 19, Vite 7, Tailwind v4, TanStack Start v1.169. Watch: `@tanstack/start-client-core` and `@tanstack/react-router` versions drift (1.167.50 + 1.168.25 + 1.169.x), `vitest@4.1.6` is a pre-release line. |
| Content | 🟢 Mostly fine | Surveys mirror the Sinhala source 1:1; consent items are present; stale doc comments. |
| UI/UX | 🟢 Strong | Mobile-first, large tap targets, swipe + keyboard + focus-trap, prefers-reduced-motion honoured, sticky CTA, error-summary with auto-focus. Some a11y gaps: text-only `aria-label` icon-only Back button, `<header>` lang attribute, slug exposure in URL. |
| Multilanguage | 🟢 Mature | Three-key dictionary with `pickText` fallback, `<html lang>` pre-hydration script, Noto Sans Sinhala / Tamil preloaded, language toggle persists via localStorage + survives resume. |
| DX & ops | 🟠 Limited | Two narrow GitHub Action workflows (csv-export-shape + guardrails). No type-check / unit-test / e2e gate on PRs. No bundle-size CI. No Lighthouse budget. |

## Read order

1. Start with this overview.
2. Skim `99-master-todo.md` for the prioritised plan.
3. Drill into individual audits for rationale + file/line citations.
