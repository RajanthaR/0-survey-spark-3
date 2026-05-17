# Testing Audit

## Current State

The repo has substantial Vitest coverage under `src/**/__tests__` and one Playwright spec under `e2e/`. Existing tests cover survey runner behavior, i18n, a11y assertions, admin exports, streaming protocol, CSV/XLSX/codebook behavior, alerts, and visual invariants. GitHub Actions currently run targeted guardrail and CSV export shape suites.

## Findings

- TypeScript passes locally with `./node_modules/.bin/tsc --noEmit`.
- Vitest is blocked before test execution by Rollup native optional dependency loading.
- Playwright is blocked because its webServer command uses `bun run dev`, and Bun is missing in this shell.
- ESLint failure volume is high enough that test results would be hard to trust until formatting/guardrail cleanup lands.
- CI coverage is narrow: targeted guardrail tests and CSV shape tests exist, but broad lint/typecheck/build/test/e2e jobs are not shown.
- `package.json` has `test`, `test:e2e`, `lint`, `build`, and `smoke`, but no explicit `typecheck`, `format:check`, or package-manager-compatible audit script.
- Playwright has only one `e2e/*.spec.ts` file in the top-level e2e folder, while many browser-like tests are implemented in Vitest/jsdom.

## Suggested Improvements

- Restore local tooling first: Bun or script alternatives, Rollup native dependency, and reproducible install instructions.
- Add `typecheck`, `format:check`, and lockfile-appropriate `audit` scripts.
- Add CI jobs for lint, typecheck, build, full Vitest, and a smoke/e2e subset.
- Expand Playwright coverage for happy paths in EN/SI/TA, resume flow, admin login/reset, and export progress.
- Keep jsdom tests for fast unit/integration behavior, but use Playwright for real focus, layout, service worker, and browser storage behavior.
- Add a test data strategy for admin exports and large datasets.
- Capture blocked-command output in troubleshooting docs so future agents do not rediscover the same environment issue.

## Priority

- P0: Make test/build commands runnable.
- P1: Make lint and typecheck mandatory CI gates.
- P1: Add respondent EN/SI/TA Playwright happy path.
- P2: Add large export and service worker tests.

## Verification

- `./node_modules/.bin/tsc --noEmit` passes.
- `./node_modules/.bin/vitest run` is blocked by Rollup native optional dependency/code-signing failure.
- `./node_modules/.bin/playwright test` is blocked because `/bin/sh: bun: command not found`.
- Existing counts from inspection: `79` source test files, `1` top-level Playwright spec, and about `209` source TypeScript/TSX files.

## Related Files

- `package.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `.github/workflows/guardrails.yml`
- `.github/workflows/csv-export-shape.yml`
- `src/test/setup.ts`
- `e2e/survey-language-toggle.spec.ts`
- `scripts/smoke-ssr.mjs`
