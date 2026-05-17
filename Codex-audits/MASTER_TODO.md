# Master Todo

Date: 2026-05-17

This is the ordered implementation backlog compiled from the audit files in this folder. It intentionally starts with tooling and guardrails because later security, UX, architecture, and performance work cannot be verified safely until the basic commands run.

Status legend: `[ ]` not started, `[~]` in progress, `[x]` done.

## Phase 0 - Tooling Baseline

- [ ] Restore Bun availability in local/dev/CI environments, or change scripts and Playwright webServer to a supported package runner.
- [ ] Repair Rollup native optional dependency loading so `vite build` and `vitest run` can start.
- [ ] Choose one primary package manager and document it. If Bun remains primary, keep `bun.lock` as source of truth; if pnpm is supported, commit and maintain `pnpm-lock.yaml`.
- [ ] Add `typecheck`, `format:check`, and lockfile-appropriate `audit` scripts to `package.json`.
- [ ] Add a local troubleshooting note for `bun: command not found`, Rollup native loading, and package-manager audit mismatch.
- [ ] Re-run and record: `git status --short`, `typecheck`, `lint`, `format:check`, `test`, `build`, `test:e2e`, and dependency audit.

## Phase 1 - Guardrails And Formatting

- [ ] Run a formatting-only pass and review generated-file handling before committing.
- [ ] Resolve all `no-restricted-syntax` Sinhala/Tamil violations by moving localized strings into approved dictionaries or intentionally allowlisting dictionary modules.
- [ ] Clean stale eslint-disable comments after formatting and rule fixes.
- [ ] Fix or justify the `SurveyRunner` hook dependency warning.
- [ ] Add an i18n completeness scan for required EN/SI/TA keys.
- [ ] Add a same-as-English translation review report so intentional unit/code labels are separated from untranslated copy.
- [ ] Make `./node_modules/.bin/eslint .` pass before large refactors.

## Phase 2 - Security And Privacy

- [ ] Decide production Turnstile policy: fail closed without `TURNSTILE_SECRET`, or enforce a deploy preflight that prevents missing production secrets.
- [ ] Add production env preflight documentation for Supabase URL/key/service role, `ADMIN_BOOTSTRAP_EMAIL`, Turnstile site key/secret, and bypass settings.
- [ ] Review `adminLoginGuard` semantics so prior failures actually lock the next check, or rename/comment the current behavior accurately.
- [ ] Review resume-token lifecycle for in-progress responses, including optional expiration or rotation after inactivity.
- [ ] Refine resume link reveal copy and keep the privacy warning visible.
- [ ] Document PII/export handling: allowed admins, storage location, retention, deletion, request ID logging, and incident response.
- [ ] Review CSP after build works and remove `unsafe-inline` only where framework-supported alternatives are practical.
- [ ] Decide when in-memory rate limiting should move to a durable Cloudflare KV/Durable Object style store.

## Phase 3 - Test And CI Reliability

- [ ] Add CI jobs for lint, typecheck, build, full Vitest, and a practical Playwright/smoke subset.
- [ ] Expand Playwright respondent happy paths for English, Sinhala, and Tamil.
- [ ] Add Playwright coverage for resume link reveal/copy, language switching, review/edit, and final submit.
- [ ] Add Playwright/admin workflow coverage for login/reset, filters, response detail, export progress, and request ID copy.
- [ ] Keep jsdom tests for fast unit/integration coverage, but reserve Playwright for real focus, layout, storage, service worker, and browser-download behavior.
- [ ] Add large dataset fixtures or mocks for CSV/XLSX/ZIP export recovery tests.
- [ ] Run SSR smoke tests locally and against deployed preview once server startup works.

## Phase 4 - Architecture And Code Quality

- [ ] Split `src/routes/admin.tsx` into route shell plus focused admin modules: auth, filters, stats, response list/detail, exports, reports, codebook, alerts.
- [ ] Extract `SurveyRunner` hooks for autosave, visibility flush, resume token persistence, and stage navigation after respondent tests are in place.
- [ ] Reduce large server/helper modules by extracting query builders, export pipeline helpers, and typed filter contracts where they reduce duplication.
- [ ] Replace avoidable `any` casts around Supabase inserts/updates with typed helpers or local typed payloads.
- [ ] Add an architecture README covering route boundaries, server functions, Supabase access, survey definitions, admin exports, and where new features belong.
- [ ] Preserve the shared generator approach for streaming export transports.

## Phase 5 - UX, Accessibility, And Multilingual Polish

- [ ] Browser-test respondent flow across mobile, tablet, and desktop viewports.
- [ ] Verify sticky action bar plus resume strip do not hide content on small screens or safe-area devices.
- [ ] Rename initial resume reveal action to a clearer label such as "Show link" or "Get link"; keep "Copy link" for the actual clipboard action.
- [ ] Validate custom choice controls with keyboard and screen readers.
- [ ] Test `prefers-reduced-motion`, 200 percent zoom, focus return, validation summary focus, and question map drawer behavior.
- [ ] Verify `html lang`, SI/TA font rendering, and multilingual screen-reader output after language switches.
- [ ] Review consent, start, contact, export, and admin onboarding copy with the research owner.
- [ ] Add a researcher operations checklist for launch, monitoring, export, validation, closeout, and data handling.

## Phase 6 - Performance And Deployment

- [ ] Run production build and bundle analysis after Rollup/Vite are fixed.
- [ ] Measure respondent route bundle/load separately from admin route bundle/load.
- [ ] Confirm Recharts, PDF, XLSX, ZIP, and export-only code stay out of respondent bundles.
- [ ] Verify option-image prefetching and service worker cache behavior in real browsers.
- [ ] Load-test admin exports and stats queries with realistic response counts.
- [ ] Decide when to add SQL aggregate views for stats if row caps become correctness limits.
- [ ] Update `docs/DEPLOYMENT.md` with the final preflight, smoke, env, and rollback checklist.
- [ ] Review or regenerate `db/schema.sql` after migration changes and record the comparison date.

## Audit Documentation Progress

- [x] Created `00-audit-index.md`.
- [x] Created content, UI/UX, accessibility, performance, testing, architecture, code quality, security/privacy, i18n, tech stack, database/deployment, and product/admin workflow audits.
- [x] Compiled this master todo in execution order.
- [ ] Implement product/code fixes from the phases above.
