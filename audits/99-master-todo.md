# Master TODO — phased execution plan

Compiled from `01-content` … `10-other`. Each item has an ID matching the source audit, an effort estimate (XS = <1h, S = 1–4h, M = 4h–1d, L = 1–3d, XL = >3d), and a "why" anchor.

> **Suggested cadence:** P0 in week 1, P1 over weeks 2–3, P2 over weeks 4–6, P3 as backlog.

---

## P0 — Ship this week (bug fixes + broken CI)

| # | ID | Title | Effort | Why |
| --- | --- | --- | --- | --- |
| 1 | Q-1 | Fix React Hook order bug in `FilteredPreviewExtras.tsx:118-121` (move `useState` above the early return). | XS | Real `react-hooks/rules-of-hooks` violation. |
| 2 | C-2 / I-2 | Move 5 inline SI/TA literals into dictionaries. | S | Three guardrail tests fail today; real i18n leak. |
| 3 | T-2 / T-3 | Reconcile SurveyRunner motion + announcement contract tests (revert to duration tween OR update test expectations). | M | ~30 tests failing on `main`. |
| 4 | T-1 | Wrap server-fn unit tests in a Start context harness (or extract Turnstile guard logic into a plain helper). | M | 9 tests failing on `AsyncLocalStorage`. |
| 5 | T-5 | Re-add codebook XLSX freeze-pane (`!freeze.ySplit = 1`). | XS | 1 test failing; lost accessibility on header row. |
| 6 | O-1 | Add a `pr.yml` running `typecheck`, `lint`, `test`. | S | Prevents the next regression; tests currently run nowhere on PRs. |
| 7 | Q-7 | Run `eslint --fix` + `prettier --write` once; commit. | S | 1 865 trivial errors disappear. |
| 8 | C-1 / I-3 | Fix stale "TA = TODO" comments in `phase-1.ts:7` and `phase-3.ts:7`. | XS | Misleading docs. |

**Done when:** `bun run test` is green, `bun run lint` reports 0 errors, GitHub Actions blocks PRs that regress either.

---

## P1 — Sprint 2-3 (security hardening + a11y)

| # | ID | Title | Effort | Why |
| --- | --- | --- | --- | --- |
| 9 | S-1 | Require `TURNSTILE_SECRET` in production; throw at startup if missing. | S | Closes fail-open in prod. |
| 10 | S-2 | Implement admin login lockout (per-email + per-IP). | M | Brute-force defence. |
| 11 | S-6 | Add CSP / HSTS / Permissions-Policy headers via request middleware. | S | OWASP basics. |
| 12 | U-3 / S-7 | Remove resume token from URL bar (localStorage-only or fragment). | M | History + log leakage. |
| 13 | U-2 / I-4 | Emit correct `<html lang>` on SSR first byte (cookie/hint). | S | A11y for non-JS + crawlers. |
| 14 | U-4 | Add a "Skip to main content" link. | XS | WCAG 2.4.1. |
| 15 | U-11 / I-5 | Localise 404, 500, "Survey not found" pages. | S | Maintains language on failure. |
| 16 | U-8 / I-7 | Add richer Likert `aria-label` (`"5: Strongly agree"`). | XS | SR comprehension. |
| 17 | U-9 | Mark duplicated percent chip `aria-hidden="true"`. | XS | Avoid double-announce. |
| 18 | U-10 | Gate "Continue anyway" Turnstile bypass behind `?dev=1` instead of `localhost`. | XS | Avoids confused testers. |
| 19 | S-3 | Move rate-limit Map to Durable Object / KV. | M | Isolate-restart resilience. |
| 20 | T-6 / T-7 / T-8 | Add typecheck + lint + test gates to CI (already in #6) **plus** make `eslint --max-warnings 0` enforce zero. | XS (after #6) | Stop bleed. |
| 21 | T-9 | Add `vitest --coverage` with 70/80 floor on `src/lib/`. | S | Visibility on regressions. |
| 22 | T-10 | Add WebKit project to Playwright config. | XS | Mobile Safari is large in the target market. |

---

## P2 — Sprint 4-6 (refactor + perf + DX)

| # | ID | Title | Effort | Why |
| --- | --- | --- | --- | --- |
| 23 | A-2 / P-1 | Split `admin.tsx` into per-feature child routes (`/admin/exports`, `/admin/stats`, `/admin/responses`). | XL | 4 099-line monolith; per-route lazy chunks. |
| 24 | A-1 | Extract `useAutoSave`, `useResumeToken`, `useSurveyMachine` from `SurveyRunner.tsx`. | L | 877-line component; #6/#7/#12 become trivial after. |
| 25 | A-3 / Q-4 | Type the Supabase filter chain; drop the 8 `as any` casts. | M | Type drift insulation. |
| 26 | A-4 | De-duplicate `isAnswered` between `survey-logic.ts` and `validation.ts`. | XS | Single source of truth. |
| 27 | A-5 | Move admin pure functions under `src/lib/admin/`. | S | Unit-testability. |
| 28 | A-10 | Tighten `LocalizedString` generics so missing translations fail at compile time. | S | Eliminates entire bug class. |
| 29 | P-3 / P-4 | Build a `survey_stats` SQL view; switch `getStats` to a single aggregate query. | M | Removes 2 000-row cap; reduces 3-roundtrip cost. |
| 30 | P-6 | Defer Noto Sans Sinhala/Tamil fonts until SI/TA is active. | S | ~150 KB off cold path for EN-only users. |
| 31 | P-5 | Audit pre-hydration `<script>` against future CSP. | XS | Plan ahead before #11 locks in `script-src`. |
| 32 | P-8 | Memoize `visibleQuestions` / `progressFor`. | S | Avoid per-keystroke recompute. |
| 33 | O-3 / O-4 | Add structured logger + Sentry (server + client). | M | Production debugging. |
| 34 | O-5 | Track journey events via Cloudflare Analytics Engine. | S | Drop-off insight. |
| 35 | Q-6 | Reconsider `react-refresh/only-export-components` warnings for UI primitives. | XS | DX polish. |
| 36 | Q-9 | Add `husky` + `lint-staged` pre-commit hook. | XS | DX polish. |
| 37 | St-1 / St-2 | Pin `@tanstack/*` versions to same minor; downgrade Vitest to stable 3.x. | S | Dependency hygiene. |
| 38 | St-3 | Run `knip` / `depcheck`; drop dead deps. | S | Bundle shrink. |
| 39 | St-6 | Commit `bun.lock` (or stop using `--frozen-lockfile` in CI). | XS | CI reliability. |
| 40 | O-8 / O-9 | Add `CONTRIBUTING.md` + `SECURITY.md`. | S | Onboarding. |
| 41 | O-10 / O-13 | Add `.tool-versions` + `.gitattributes`. | XS | DX polish. |
| 42 | C-4 / I-6 / C-3 | Localise researcher CTA + bring SI/TA `intro` to parity with EN. | XS | Recruitment hook parity. |

---

## P3 — Backlog (nice-to-have, post-launch)

| # | ID | Title | Effort |
| --- | --- | --- | --- |
| 43 | A-9 | Introduce a domain layer (`domain/respondent.ts`) decoupling Turnstile/RateLimit/Supabase. | L |
| 44 | A-8 | `.gitattributes` for generated files. | XS |
| 45 | S-8 | RLS deny-by-default for INSERT/UPDATE/DELETE. | S |
| 46 | S-13 | Cron to purge stale `in_progress` rows after 30 days. | S |
| 47 | S-12 | Smoke check for Supabase email confirmation setting. | XS |
| 48 | P-7 | Verify `recharts` is excluded from admin login chunk. | XS |
| 49 | P-9 | Load-test admin exports at 50 k+ rows. | M |
| 50 | P-10 | `<picture>` AVIF + WebP for option illustrations. | S |
| 51 | T-11 | Add `size-limit` to gate bundle regressions. | S |
| 52 | T-12 | Verify Recharts is excluded from Vitest jsdom paths. | XS |
| 53 | T-13 | Tests for Turnstile happy path, token rotation, rate-limit boundaries. | M |
| 54 | I-1 | Audit dictionary parity (67 EN vs 66 SI/TA in `i18n.tsx`). | XS |
| 55 | C-5 | Per-survey `og:description`, `og:image`. | S |
| 56 | C-7 | Differentiate save/complete/Turnstile failure toasts. | XS |
| 57 | C-8 | Trim `Changelog.md` to per-quarter rotation. | S |
| 58 | U-1 | Visible label on icon-only Back button at `sm:` breakpoint. | XS |
| 59 | U-5 | Bump auto-advance delay; skip on keyboard. | XS |
| 60 | U-6 | Match pre-hydration CSS to hydrated `opacity:1`. | S |
| 61 | U-7 | Standardise error rendering (toast vs banner vs modal). | S |
| 62 | U-12 | Contrast audit on `gradient-eco` overlays. | S |
| 63 | U-13 | Guard swipe handler against textarea pointer-down. | XS |
| 64 | U-15 | Turnstile loading skeleton on consent. | XS |
| 65 | St-4 | Migrate `xlsx` → `exceljs`. | M |
| 66 | St-5 | Audit `@tanstack/react-query` necessity. | XS |
| 67 | St-7 | Expand `docs/DEPLOYMENT.md` (SW cache, CF routing). | S |
| 68 | St-9 / St-10 | `typecheck` script + Node fallback docs. | XS |
| 69 | O-2 | Local Supabase docker-compose for CI integration tests. | M |
| 70 | O-12 / O-15 | `docker-compose` local dev + `dev:reset` script. | S |
| 71 | O-16 | Explicit `LICENSE` file. | XS |
| 72 | I-8 | Tamil reviewer attribution. | XS |
| 73 | Q-2 | Investigate `exhaustive-deps` warning in `SurveyRunner.tsx:448`. | XS |
| 74 | Q-5 | Drop the 9 unused `eslint-disable` directives. | XS |
| 75 | Q-8 | Split `admin.shared.server.ts` (865 lines), `sidebar.tsx` (744 lines), `admin.stats.functions.ts` (706 lines). | M |

---

## Quick-wins clustered by file

If reviewing PRs file-by-file is easier:

- **`src/components/SurveyRunner.tsx`** — Q-2, C-2 (skipped pill), U-1, U-9, U-13, A-1.
- **`src/components/admin/FilteredPreviewExtras.tsx`** — Q-1 (real Hook bug).
- **`src/routes/admin.tsx`** — A-2 / P-1 (split into routes), I-2 (`admin.tsx:2468` inline literal).
- **`src/routes/__root.tsx`** — U-2 / I-4 (`<html lang>`), U-4 (skip link), U-11 (localise error pages).
- **`src/surveys/phase-1.ts` / `phase-3.ts`** — C-1 / I-3 (stale doc comment).
- **`src/lib/turnstile.server.ts`** — S-1 (fail-open in prod).
- **`src/lib/rate-limit.server.ts`** — S-3 (Durable Object).
- **`src/lib/i18n.tsx`** — I-1 (dictionary parity), C-4 (intro parity).
- **`.github/workflows/`** — O-1 (pr.yml), T-6/T-7/T-8 (typecheck + lint + test gates).

---

## What I would do first if I were taking this on

1. **One day** on P0 (#1-#8): turn the suite green, get a CI gate in.
2. **Two days** on security (#9, #10, #11, #12, #15): close fail-open, lockout, headers, URL token, localised error pages.
3. **One day** on the `admin.tsx` split (#23): it unlocks every future admin change.
4. **One day** on `SurveyRunner.tsx` extraction (#24): same logic for the respondent flow.

Everything else flows into a sustainable backlog once the suite is green and PRs are gated.
