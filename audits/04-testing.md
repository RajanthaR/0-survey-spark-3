# Audit 04 — Testing

Scope: Vitest unit/integration suite, Playwright e2e, guardrail tests, CI gates.

## Current state

- **81** test files in `src/**/__tests__/` (Vitest, jsdom).
- **`e2e/`** holds Playwright specs gated on a running dev server.
- **GitHub Actions** runs only two narrow guardrails — `csv-export-shape.yml` and `guardrails.yml`. The full test suite is **not** executed on PRs.
- Local result on `main` (`bun run test`):
  - **Tests:** 51 failed / 483 passed (534 total).
  - **Test files:** 16 failed / 63 passed (79 total).
  - Duration: ~67 s.

## Failure clusters

### T-1 — TanStack Start `AsyncLocalStorage` plumbing (9 failures)

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/__tests__/responses.turnstileGuard.test.ts:199` throws:

```text
No Start context found in AsyncLocalStorage. Make sure you are using the function within the server runtime.
```

`createServerFn` middleware needs a Start context provider in tests; the test currently calls the bound `serverFn` directly. Wrap the call in the same harness that other server-fn tests use, or factor the Turnstile guard into a plain function and unit-test that.

### T-2 — SurveyRunner motion-contract regressions (~25 failures)

Tests like `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/__tests__/SurveyRunner.questionCountAnimation.test.tsx:198` assert:

```text
{ duration: 0.25 } but received { type: "spring", stiffness: 320, damping: 32, mass: 0.6 }
```

The `<QuestionView>` transition was changed from a fixed-duration tween to a spring (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/survey/QuestionView.tsx:117-123`) but the test contracts were never updated. Either:

- Revert to a duration-based transition (so SR announcement timing is predictable), or
- Update the contract tests to assert the spring shape.

### T-3 — Live-region announcement contract drift

`SurveyRunner.backAnnouncements.a11y.test.tsx`, `SurveyRunner.nextAnnouncements.a11y.test.tsx`, `SurveyRunner.progressAnnouncements.e2e.test.tsx`, `SurveyRunner.rapidBackAnnouncements.a11y.test.tsx` all fail. Inspect the new `QuestionPosition` / `QuestionCount` flow — the live-region text is likely emitted later in the render cycle now.

### T-4 — i18n guardrails catching real leaks (real bugs)

- `no-inline-localized-labels.test.ts` flags 5 inline SI/TA literals (see `audits/01-content.md` C-2).
- `no-hardcoded-question-strings.test.ts` flags hardcoded EN count strings.
- `codebook-yes-no-labels.test.ts` passes — good.

These are real bugs and should be fixed by moving strings into dictionaries.

### T-5 — Codebook XLSX freeze pane lost

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/__tests__/codebook-xlsx.test.ts:114`:

```text
expected undefined to be 1 (ySplit)
```

The codebook XLSX export no longer writes a freeze pane on the header row. Either the SheetJS option was renamed or it was dropped during a refactor. Re-add `worksheet["!freeze"] = { ySplit: 1 }`.

## Gaps

### T-6 — No PR gate runs the full suite

Add a `bun run test` job (plus optional Playwright sharded job) to `.github/workflows/`. Without it, the 51 failing tests on `main` would have been caught at PR time.

### T-7 — No type-check gate

`tsc --noEmit` passes locally but isn't gated in CI.

### T-8 — No lint gate

ESLint produces **1 949** problems (1 865 auto-fixable). Add a CI lint job; bump `lint` script to run `eslint --max-warnings 0` once Prettier is auto-fixed.

### T-9 — No coverage report

No `vitest --coverage` invocation. Add to CI with a 70% line / 80% branch floor on `src/lib/` (the pure logic) — UI components are harder to baseline.

### T-10 — Playwright suite is single-browser

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/playwright.config.ts:25-27` only runs Chromium. Add WebKit at minimum (iOS Safari) since the audience is heavily mobile.

### T-11 — No bundle-size regression test

Add `size-limit` to flag PRs that push the `/` route over an agreed budget.

### T-12 — Tests assume jsdom but some use Recharts SVG measurement

Verify that the chart-lazy bundle is excluded from Vitest (it relies on real DOM measurements).

### T-13 — Missing tests for new flows

- Turnstile happy path through `OptionalConsentPanel`.
- Resume URL rotation after `completeResponse`.
- Per-IP rate-limit boundaries (response under 429 etc).
- Admin "view response" lazy load.
- A11y axe scan on `/admin` (separate Playwright project).

## Suggested improvements (Testing)

1. **Stop the bleed:** fix the ~30 SurveyRunner contract tests by updating expectations to match the spring transition, or revert the transition.
2. Wrap server-fn tests in a Start context harness (or extract Turnstile guard logic into a plain function).
3. Re-add the codebook XLSX freeze-pane line.
4. Move every inline SI/TA literal into a dictionary so the i18n guardrails pass.
5. Add a CI job: `bun run typecheck`, `bun run lint`, `bun run test`, `bun run test:e2e`.
6. Add a `vitest --coverage` gate at 70/80 on `src/lib/`.
7. Add WebKit project to Playwright config.
8. Add `size-limit` for bundle-size regressions.
9. Backfill tests for Turnstile happy path, token rotation, and rate-limit boundaries.
10. Add axe-core regression scan on `/`, `/s/$slug`, `/admin`.
