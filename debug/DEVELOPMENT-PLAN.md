# Survey Spark 3 Development Plan

**Date:** 2026-05-24
**Source audit:** `debug/AUDIT-REPORT.md`
**Goal:** implement the 8 audit follow-up items using parallel-safe Git worktrees, with clear ownership boundaries and verification gates.

## Implementation steps covered

1. Normalize repo line endings and restore local tooling reliability.
2. Fix SurveyRunner navigation and validation behavior.
3. Fix SurveyRunner focus restoration and live announcements.
4. Fix language persistence and resume-language behavior.
5. Paginate or disclose admin analytics row limits.
6. Reduce or validate large production client chunks.
7. Improve form-label accessibility polish.
8. Run production-equivalent Node 24 SSR smoke verification.

## Worktree strategy

Use **5 worktrees**: 4 feature worktrees plus 1 integration/verification worktree. This allows independent implementation while keeping high-conflict survey-runner changes isolated.

Recommended parent folder layout:

| Worktree                                   | Branch                           | Purpose                              |
| ------------------------------------------ | -------------------------------- | ------------------------------------ |
| `..\0-survey-spark-3-wt-tooling`           | `fix/tooling-line-endings`       | Step 1 only                          |
| `..\0-survey-spark-3-wt-survey-core`       | `fix/survey-navigation-focus`    | Steps 2 and 3                        |
| `..\0-survey-spark-3-wt-survey-i18n-a11y`  | `fix/survey-i18n-a11y`           | Steps 4 and 7                        |
| `..\0-survey-spark-3-wt-admin-performance` | `fix/admin-analytics-bundle`     | Steps 5 and 6                        |
| `..\0-survey-spark-3-wt-integration`       | `chore/integration-node24-smoke` | Step 8 and final merged verification |

Example setup commands from the main repo root:

```powershell
git worktree add ..\0-survey-spark-3-wt-tooling -b fix/tooling-line-endings
git worktree add ..\0-survey-spark-3-wt-survey-core -b fix/survey-navigation-focus
git worktree add ..\0-survey-spark-3-wt-survey-i18n-a11y -b fix/survey-i18n-a11y
git worktree add ..\0-survey-spark-3-wt-admin-performance -b fix/admin-analytics-bundle
git worktree add ..\0-survey-spark-3-wt-integration -b chore/integration-node24-smoke
```

Do not merge all worktrees blindly. Merge in the dependency order below.

## Dependency order

1. **Merge Worktree 1 first**: line-ending normalization affects almost every file and should be isolated in a dedicated PR.
2. **Merge Worktree 2 second**: SurveyRunner navigation/focus changes are the highest product risk.
3. **Merge Worktree 3 third**: i18n/a11y polish may touch nearby survey UI files and should rebase after Worktree 2.
4. **Merge Worktree 4 anytime after Worktree 1**: admin analytics and bundle work is mostly independent.
5. **Run Worktree 5 last**: integration and Node 24 smoke should happen after the feature branches are merged or rebased together.

## Worktree 1: tooling and line endings

**Branch:** `fix/tooling-line-endings`
**Primary step:** 1

### Scope

- Add a repo-level line-ending policy.
- Re-normalize tracked source files once.
- Ensure `bun run format:check` and `bun run lint -- --max-warnings 0` are usable on Windows.
- Avoid mixing functional code changes into this branch.

### Likely files

- `.gitattributes`
- `.prettierrc`, `prettier.config.*`, or `package.json` only if needed
- Many normalized source files if a one-time renormalization is required

### Implementation tasks

- Add a `.gitattributes` policy for LF source files.
- Decide whether generated snapshots should also be LF-normalized.
- Run a one-time normalization using Git after the policy is added.
- Confirm that `src/routeTree.gen.ts` and CSV snapshots no longer appear modified from line-ending/stat noise after routine commands.

### Acceptance criteria

- `git ls-files --eol` shows source files as `i/lf w/lf` on Windows after checkout/renormalization.
- `bun run format:check` no longer fails purely due CRLF carriage returns.
- `bun run lint -- --max-warnings 0` no longer reports mass `Delete ΓÉì` Prettier errors.
- The PR contains no unrelated SurveyRunner, admin, or behavior changes.

### Verification commands

```powershell
$env:Path = "$env:USERPROFILE\.bun\bin;$env:Path"
bun run format:check
bun run lint -- --max-warnings 0
git status --short
```

## Worktree 2: SurveyRunner navigation, validation, focus, and announcements

**Branch:** `fix/survey-navigation-focus`
**Primary steps:** 2 and 3

### Scope

- Fix Back/Next answer preservation.
- Fix invalid-but-filled answer handling.
- Fix Next-button disabled behavior.
- Decide and implement the focus contract.
- Fix progress/question live announcements.

### Likely files

- `src/components/survey/SurveyRunnerImpl.tsx`
- `src/components/survey/SurveyRunnerView.tsx`
- `src/components/survey/hooks/useFocusReturn.ts`
- `src/components/survey/QuestionView.tsx`
- `src/components/survey/validation.ts`
- `src/components/__tests__/SurveyRunner.backFocusReturn.a11y.test.tsx`
- `src/components/__tests__/SurveyRunner.nextAnnouncements.a11y.test.tsx`
- `src/components/__tests__/SurveyRunner.nextDisabled.e2e.test.tsx`
- `src/components/__tests__/SurveyRunner.rapidBackAnnouncements.a11y.test.tsx`
- `src/components/__tests__/SurveyRunner.telNumRangeGating.e2e.test.tsx`

### Implementation tasks

- Replace implicit "next unanswered" skipping on normal Next with adjacent navigation, or make the skip predicate validate answer format before skipping.
- Ensure invalid values like short telephone numbers remain visible and editable after Back/Next.
- Unify the definition of blocked navigation across:
  - button disabled state,
  - `goNext`,
  - keyboard navigation,
  - auto-advance behavior.
- Choose one focus contract:
  - focus the new question or answer control, or
  - focus the sticky navigation button.
- Update `useFocusReturn` and `FocusTrap` so the focus target is not fighting another component.
- Ensure `QuestionPosition` and related live regions announce progress consistently after Next and Back.

### Acceptance criteria

- The 6 failing SurveyRunner test files from the audit pass.
- Manual keyboard navigation works in all three languages.
- Back then Next preserves entered values and does not skip invalid answers.
- No regression to auto-advance on pointer selection.
- The chosen focus behavior is documented in tests, not only comments.

### Focused verification commands

```powershell
$env:Path = "$env:USERPROFILE\.bun\bin;$env:Path"
bun run test -- src/components/__tests__/SurveyRunner.backFocusReturn.a11y.test.tsx
bun run test -- src/components/__tests__/SurveyRunner.nextAnnouncements.a11y.test.tsx
bun run test -- src/components/__tests__/SurveyRunner.nextDisabled.e2e.test.tsx
bun run test -- src/components/__tests__/SurveyRunner.rapidBackAnnouncements.a11y.test.tsx
bun run test -- src/components/__tests__/SurveyRunner.telNumRangeGating.e2e.test.tsx
bun run test -- src/components/__tests__/SurveyRunner.saveExitAfterBack.e2e.test.tsx
```

### Broader verification

```powershell
bun run typecheck
bun run test -- --exclude "**/codebook-xlsx.test.ts"
```

## Worktree 3: survey i18n, resume precedence, and accessibility polish

**Branch:** `fix/survey-i18n-a11y`
**Primary steps:** 4 and 7

### Scope

- Define and implement resume-language precedence.
- Fix test isolation around language localStorage keys.
- Improve explicit label/input associations.
- Keep this branch separate from core navigation logic where possible.

### Likely files

- `src/lib/i18n.tsx`
- `src/routes/s.$slug.tsx`
- `src/routes/r.$token.tsx`
- `src/components/survey/SurveyRunnerImpl.tsx`
- `src/components/survey/SurveyRunnerView.tsx`
- `src/routes/reset-password.tsx`
- `src/test/setup.ts`
- SurveyRunner language/resume tests

### Implementation tasks

- Decide language precedence:
  - direct resume-link language wins,
  - browser-touched language wins,
  - or route context decides case-by-case.
- Make the chosen rule explicit in code and tests.
- Ensure tests clear both `eip.lang` and `eip.lang.touched` before relevant cases.
- Add explicit `id` and `htmlFor` pairs for password-reset fields.
- Add explicit `id` and `htmlFor` pairs for survey contact fields.
- Review other manually labeled fields touched by this worktree.

### Acceptance criteria

- Resume-language behavior is predictable and covered by tests.
- `SurveyRunner.saveExitAfterBack.e2e.test.tsx` no longer fails due unexpected persisted language.
- Password reset and survey contact inputs have explicit accessible names.
- No duplicate IDs are introduced across repeated survey instances.

### Verification commands

```powershell
$env:Path = "$env:USERPROFILE\.bun\bin;$env:Path"
bun run test -- src/components/__tests__/SurveyRunner.saveExitAfterBack.e2e.test.tsx
bun run test -- src/lib/__tests__/i18n-parity.test.ts
bun run typecheck
```

If Playwright browsers are available:

```powershell
bun run build
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:4173"
bun run test:a11y
```

## Worktree 4: admin analytics and bundle performance

**Branch:** `fix/admin-analytics-bundle`
**Primary steps:** 5 and 6

### Scope

- Fix or disclose the 5,000-row analytics cap.
- Verify admin export/report correctness for larger datasets.
- Analyze production bundle shape and reduce avoidable large chunks.

### Likely files

- `src/lib/admin.stats.functions.ts`
- `src/lib/admin.shared.server.ts`
- `src/lib/admin.exports.functions.ts`
- `src/routes/admin.tsx`
- `src/routes/admin/charts-lazy.ts`
- `src/components/admin/*`
- `vite.config.ts`
- Bundle-shape tests or scripts if needed

### Implementation tasks

- Replace the fixed `q.limit(5000)` analytics query with pagination, or return a visible truncation flag and count metadata.
- Add/adjust tests for more than 5,000 responses if practical using mocked Supabase pagination.
- Run `bun run size` and `bun run bundle:shape` after a fresh build.
- Verify `xlsx`, `jspdf`, `html2canvas`, charting, and report-only code stay out of respondent routes.
- Introduce dynamic imports only where bundle-shape output proves value.

### Acceptance criteria

- Admin analytics no longer silently undercounts large datasets.
- UI clearly indicates truncation if any cap remains.
- Bundle-shape output does not show admin-only libraries leaking into public respondent routes.
- Build still passes.

### Verification commands

```powershell
$env:Path = "$env:USERPROFILE\.bun\bin;$env:Path"
bun run test -- src/lib/__tests__/*admin*
bun run test -- src/routes/__tests__/admin.*
bun run build
bun run size
bun run bundle:shape
```

## Worktree 5: integration and production-equivalent Node 24 smoke

**Branch:** `chore/integration-node24-smoke`
**Primary step:** 8

### Scope

- Rebase or merge all completed worktrees into one integration branch.
- Verify the app using the documented Node 24 runtime path.
- Produce final go/no-go evidence.

### Prerequisites

- Worktree 1 merged or rebased in.
- Worktree 2 merged or rebased in.
- Worktree 3 merged or rebased in.
- Worktree 4 merged or rebased in.
- Node `24.15.0` available on `PATH`, or the closest installed Node 24.x documented in the verification notes.

### Implementation tasks

- Confirm runtime versions:
  - Bun `1.3.14`
  - Node `24.15.0`
- Run the strict local gate.
- Run production-equivalent SSR smoke using `server-node.mjs` against `dist/`.
- If staging env vars are present, run deploy preflight and DB smoke checks.
- Record unresolved known-local test issues separately from real regressions.

### Acceptance criteria

- `bun run typecheck` passes.
- `bun run lint -- --max-warnings 0` passes.
- `bun run format:check` passes.
- Relevant focused tests pass.
- `bun run test` passes, or any local-only exclusions are explicitly documented with evidence.
- `bun run build` passes.
- Node-served SSR smoke passes on `127.0.0.1:4173`.

### Verification commands

```powershell
$env:Path = "$env:USERPROFILE\.nvm\versions\node\v24.15.0\bin;$env:USERPROFILE\.bun\bin;$env:Path"
node --version
bun --version
bun run typecheck
bun run lint -- --max-warnings 0
bun run format:check
bun run test
bun run build
```

Production-equivalent local smoke:

```powershell
$env:PORT = "4173"
$env:HOSTNAME = "127.0.0.1"
node server-node.mjs
```

In a second terminal:

```powershell
$env:BASE_URL = "http://127.0.0.1:4173"
bun run smoke
```

Optional staging-only checks, only when required env vars are present:

```powershell
bun run deploy:preflight:static
bun run deploy:preflight
bun run smoke:db
bun run db:diff:check
```

## Cross-worktree coordination rules

- Keep Worktree 1 as a pure formatting/line-ending PR.
- Do not mix SurveyRunner logic fixes into admin/performance branches.
- Do not update snapshots in multiple branches unless the owning branch changes the behavior under test.
- Rebase Worktree 3 after Worktree 2 if both touch `SurveyRunnerImpl.tsx` or `SurveyRunnerView.tsx`.
- Rebase all feature worktrees after Worktree 1 to avoid line-ending conflicts.
- Keep generated files such as `src/routeTree.gen.ts` out of PRs unless the route tree actually changes.

## Suggested PR sequence

1. `fix/tooling-line-endings`
   - Title: `Fix Windows line-ending normalization for local gates`
2. `fix/survey-navigation-focus`
   - Title: `Fix SurveyRunner navigation, validation gating, and focus behavior`
3. `fix/survey-i18n-a11y`
   - Title: `Clarify resume-language precedence and improve form labels`
4. `fix/admin-analytics-bundle`
   - Title: `Fix admin analytics row limits and validate bundle shape`
5. `chore/integration-node24-smoke`
   - Title: `Run Node 24 production-equivalent smoke verification`

## Final release checklist

- All PRs rebased after the line-ending normalization PR.
- No line-ending-only generated-file noise remains in `git status`.
- Full strict gate run recorded.
- SurveyRunner failing tests from the audit are green.
- Admin analytics behavior for more than 5,000 rows is explicit.
- Bundle-shape and size outputs reviewed.
- Node 24 SSR smoke evidence recorded.
- `debug/AUDIT-REPORT.md` and this development plan are updated if final decisions differ from the plan.
