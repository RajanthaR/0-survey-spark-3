# Audit 10 — DX, docs, CI/CD, observability, misc

## CI/CD

### O-1 — Only two narrow CI workflows

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/.github/workflows/csv-export-shape.yml` and `guardrails.yml` run only three specific test files. The other 76 test files run nowhere. Add:

- `pr.yml` — `bun install --frozen-lockfile`, `bun run typecheck`, `bun run lint`, `bun run test`, `bun run test:e2e` (sharded).
- `nightly.yml` — Lighthouse against staging, axe-core full scan, dependency-vuln scan.
- `deploy.yml` — Wrangler deploy on `main` push, conditional on the PR pipeline passing.

### O-2 — No environment for tests

CI doesn't surface `SUPABASE_URL` etc., so any integration test that hits Supabase will fail. Provide a local Supabase docker-compose for CI integration tests, or mark them `it.skipIf(!process.env.SUPABASE_URL)`.

## Observability

### O-3 — No structured logging

The code uses `console.warn` / `console.error` directly. Production logs in Cloudflare are unstructured. Wrap in a small `logger` utility that prints JSON (`{ level, msg, requestId, surveySlug, … }`).

### O-4 — No error-reporting service wired

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/start.ts:6-19` swallows server errors into a 500 page; client errors silently die. Add Sentry / Datadog / Logflare on both sides.

### O-5 — No analytics on respondent journey

There's no per-question dwell time, no drop-off event, no language-toggle event. Cloudflare Workers Analytics Engine is free; add minimal events: `survey_started`, `survey_answered`, `survey_completed`, `language_toggled`.

## Documentation

### O-6 — README missing key sections

See `audits/01-content.md` C-6. Specifically need: local dev without Supabase, Tamil reviewer, release-notes pointer.

### O-7 — `Plans/` directory not user-facing but valuable

`Plans/AuditV2-fixes.md`, `Plans/post-audit-plan.md` are internal but excellent. Reference them in `README.md` so contributors find them.

### O-8 — No `CONTRIBUTING.md`

Add: branch naming, commit-message convention, lint/typecheck/test commands, import direction (barrel vs module), code-review checklist.

### O-9 — No `SECURITY.md`

Add a responsible-disclosure path + threat model summary.

## DX

### O-10 — No `.tool-versions` / `.nvmrc`

Pin Node version (and `bun` if used) so new contributors don't waste time on version errors.

### O-11 — Pre-commit hooks absent

Add `husky` + `lint-staged` to run `prettier --check` + `eslint --max-warnings 0` on staged files.

### O-12 — No `docker-compose.yml` for local dev

A reproducible local Supabase + Worker stack would unblock contributors.

### O-13 — Generated routeTree.gen.ts pollutes diffs

Add `.gitattributes`:
```
routeTree.gen.ts merge=union linguist-generated=true
```

### O-14 — `bun run smoke` requires `BASE_URL`

Document the typical flow in README; add a `bun run smoke:local` that points at `http://localhost:5173`.

### O-15 — No `dev:reset` script

Add a `dev:reset` script that wipes localStorage + IndexedDB hints and reseeds local Supabase. Useful when testing the resume + onboarding flow.

## Licensing

### O-16 — `UNLICENSED` is appropriate but unclear

The project is private research code. Add a one-line `LICENSE` file stating "All rights reserved. © Rajantha R Ambegala 2026." and the same in `README.md`.

## Suggested improvements

1. Add a comprehensive `pr.yml` CI workflow.
2. Add `nightly.yml` for Lighthouse + axe + npm audit.
3. Add structured logging utility + Sentry / Logflare.
4. Track journey events (`survey_started`, etc.) via Cloudflare Analytics Engine.
5. Add `CONTRIBUTING.md` and `SECURITY.md`.
6. Pin Node + Bun versions (`.tool-versions`).
7. Add `husky` + `lint-staged`.
8. Add `.gitattributes` for generated files.
9. Add a `docker-compose` for local dev.
10. Add an explicit `LICENSE` file.
