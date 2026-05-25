# Survey Spark 3 Audit Report

**Date:** 2026-05-24
**Scope:** implementation gaps, route/server wiring, Supabase/server-function boundaries, frontend/survey-runner behavior, admin/export surface, security/deployment posture, and empirical gate results.

## Executive summary

The codebase is generally well-structured: the Railway/Node SSR path is explicit, Supabase service-role usage is isolated to server files, Turnstile/rate-limit/security-header concerns are centralized, and the admin export surface has meaningful pagination/streaming tests. I did not find an obvious service-role import leak into client-rendered `.tsx` files.

The main risks found are concentrated in three areas:

1. **Survey runner frontend regressions/spec drift:** the current test suite reports 19 failing tests across 6 survey-runner files. Failures cluster around focus restoration, live announcements, Next-button gating, Back/Next answer preservation, and language persistence.
2. **Windows checkout/tooling failure:** `format:check` and `lint` fail massively on this Windows checkout because files are checked out as CRLF while Prettier expects LF. This makes the local strict gate unusable on a default `core.autocrlf=true` checkout.
3. **Reporting/export edge cases:** the admin analytics report silently caps at 5,000 rows, and the production build still emits large client chunks that should be tracked against the bundle budget tools.

## Empirical gate results

| Check       | Result    | Notes                                                                                                                                                                                            |
| ----------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bun install | Completed | Bun 1.3.14 installed to `C:\Users\Rajantha\.bun\bin\bun.exe`; `bun install --frozen-lockfile` installed 829 packages. The shell showed a non-zero command status even though packages installed. |
| TypeScript  | Passed    | Direct `node_modules/.bin/tsc.exe --noEmit` exited `0`. `bun run typecheck` also reported `$LASTEXITCODE=0`, though PowerShell displayed Bun's script banner as a `NativeCommandError`.          |
| Format      | Failed    | `bun run format:check` reported style issues in 291 files. Evidence points to CRLF/LF mismatch.                                                                                                  |
| Lint        | Failed    | `bun run lint -- --max-warnings 0` reported 41,687 `prettier/prettier` errors, mostly `Delete ΓÉì`, consistent with CRLF line endings being rendered as stray carriage returns.                  |
| Tests       | Failed    | Ran `bun run test -- --exclude "**/codebook-xlsx.test.ts"` per repo guidance. Result: 6 failed test files, 94 passed; 19 failed tests, 544 passed.                                               |
| Build       | Passed    | `bun run build` completed. Vite emitted a large-chunk warning for several client chunks.                                                                                                         |

Environment notes:

- Local `node --version` was `v22.16.0`, while repo guidance expects Node `24.15.0`. The build used Bun/Vite and succeeded, but I did not run a production-equivalent Node smoke using `node server-node.mjs` because the local Node major version does not match the documented runtime.
- The command run left `git status` showing `src/routeTree.gen.ts` and `src/lib/__tests__/__snapshots__/csv-export-shape.test.ts.snap` as modified, but `git diff` showed no content diff, only CRLF warnings. This appears to be line-ending/stat noise, not an intentional content change.

## High-priority findings

### 1. Survey runner focus/navigation contract is failing

**Severity:** High
**Area:** Frontend accessibility and keyboard UX

Evidence from tests:

- `SurveyRunner.backFocusReturn.a11y.test.tsx`: active element was a button when the test expected the answer input.
- `SurveyRunner.nextAnnouncements.a11y.test.tsx`: active element did not have `data-testid="next-button"` after Next.
- `SurveyRunner.rapidBackAnnouncements.a11y.test.tsx`: expected Back button focus/announcement state was missing.

Relevant implementation:

- `src/components/survey/hooks/useFocusReturn.ts` focuses the sticky Back/Next buttons after every question transition.
- `src/components/survey/SurveyRunnerView.tsx` wraps only `<main>` in `FocusTrap`, while the sticky question nav lives outside that trap.
- `src/components/survey/QuestionView.tsx` also programmatically focuses the question heading on question changes.

This creates competing focus policies:

- `QuestionView` tries to focus the new heading.
- `FocusTrap` tries to focus the first focusable element in the main question area.
- `useFocusReturn` then moves focus to a sticky nav button outside the `FocusTrap` subtree.

Impact:

- Keyboard and screen-reader behavior is inconsistent with the current test contract.
- Focus can land outside the active focus trap even while `stage === "questions"`.
- The intended UX is unclear: comments say focus returns to the sticky CTA, while several tests expect focus to return to answer controls.

Recommended fix:

1. Decide the product contract:
   - Either keep focus on the new answer control/heading after navigation, or
   - explicitly focus sticky Back/Next buttons and update tests accordingly.
2. If keeping focus inside the question flow, remove or narrow `useFocusReturn` so it does not override answer-field/heading focus.
3. If sticky button focus is intentional, include the sticky nav inside the `FocusTrap` or rename/remove the focus-trap claim so behavior matches implementation.

### 2. Back/Next answer preservation and gating fail around answered-but-invalid values

**Severity:** High
**Area:** SurveyRunner navigation/state logic

Evidence from tests:

- `SurveyRunner.telNumRangeGating.e2e.test.tsx`: expected the active input value to remain `"12"`; received `""`.
- `SurveyRunner.nextDisabled.e2e.test.tsx`: expected Next to remain disabled; received enabled state.
- Failures reproduce across EN/SI/TA variants.

Likely root cause in code:

`src/components/survey/SurveyRunnerImpl.tsx` currently advances to the next unanswered question:

```ts
const after = visible.slice(idx + 1);
const nextUnanswered = after.find((q) => !isAnswered(q, answers));
const nextId = (nextUnanswered ?? visible[idx + 1]).id;
```

`isAnswered` only checks presence/non-empty value, not whether that value is format-valid. Therefore a telephone value like `"12"` counts as answered even though it fails `TEL_RE`. When a user goes Back and then Next, the runner can skip over the invalid-but-present question instead of returning to it with the preserved value. The resulting active question/input no longer matches the test expectation.

Impact:

- Users can be navigated past an invalid answer because navigation skip logic treats invalid values as answered.
- The sticky Next disabled state is computed for the currently rendered question, so if the current question is skipped incorrectly, the disabled/enabled state also appears wrong.

Recommended fix:

- For normal Back/Next navigation, prefer adjacent navigation (`visible[idx + 1]`) instead of skipping to next unanswered.
- Keep "jump to next unanswered" as a separate explicit action (`UI.jumpToNextUnanswered`) if that UX is desired.
- If skip-on-next is retained, make the skip predicate validate format/min-select rules, not just `isAnswered`.

### 3. Local format/lint gate is broken on Windows CRLF checkout

**Severity:** High for local developer workflow
**Area:** Tooling/formatting

Evidence:

- `bun run format:check`: failed in 291 files.
- `bun run lint -- --max-warnings 0`: failed with 41,687 `prettier/prettier` errors.
- Errors are mostly `Delete ΓÉì`, a mojibake rendering of carriage returns.
- `git config --get core.autocrlf` returned `true`.
- `git ls-files --eol` showed files like `src/server.ts`, `src/routes/admin.tsx`, and `vite.config.ts` as `i/lf w/crlf`.

Impact:

- A normal Windows checkout cannot run the documented strict gate locally.
- Any pre-commit hook that runs Prettier/ESLint may fail for line endings even without content changes.
- This also creates noisy modified/generated-file state after commands.

Recommended fix:

- Add a repo-level `.gitattributes` policy for source files, for example `* text=auto eol=lf`, with exceptions only where CRLF is required.
- Alternatively set Prettier `endOfLine` deliberately, but be careful: `endOfLine: "auto"` hides cross-platform drift rather than enforcing CI parity.
- After choosing the policy, re-normalize once in a dedicated PR.

## Medium-priority findings

### 4. Test language state appears to leak or conflict with resume-language precedence

**Severity:** Medium
**Area:** i18n/test isolation/resume UX

Evidence:

`SurveyRunner.saveExitAfterBack.e2e.test.tsx` expected `"Question 1 of 3"` but received Sinhala text (`"ප්‍රශ්න 1 / 3"`).

Relevant implementation:

- `I18nProvider` persists `eip.lang` and `eip.lang.touched` in `localStorage`.
- `adoptServerLang` intentionally refuses to override language when the user has previously touched the language toggle.

Impact:

- Tests can cross-contaminate via `localStorage` unless every test clears both language keys.
- In production, the precedence rule may surprise users: a resumed response's saved language will not apply if this browser previously selected another language.

Recommended fix:

- Confirm desired precedence for resumed responses versus explicit browser preference.
- Ensure tests reset `eip.lang` and `eip.lang.touched` before each run.
- If resume language should win only on direct resume-link entry, encode that distinction explicitly rather than relying only on `langTouched`.

### 5. Admin analytics report silently truncates at 5,000 rows

**Severity:** Medium
**Area:** Admin reporting/data correctness

Evidence:

`src/lib/admin.stats.functions.ts` uses `q.limit(5000)` in `getAnalyticsReport` and then computes totals, completion rate, language split, and drop-off from that limited list.

Impact:

- For datasets above 5,000 responses, admin analytics exports/reports can undercount without warning.
- Other admin export paths are careful to paginate, so this path is inconsistent with the rest of the export surface.

Recommended fix:

- Paginate `getAnalyticsReport` like the export functions, or
- return `truncated: true`, `rowLimit: 5000`, and a visible UI disclaimer if the cap is intentional.

### 6. Production build succeeds but emits large client chunks

**Severity:** Medium
**Area:** Frontend performance

Evidence:

`bun run build` passed but Vite warned: `Some chunks are larger than 500 kB after minification.` Large chunks in the output included client bundles around:

- `index-HzSMh2Xv.js` at ~697.72 kB raw / ~201.03 kB gzip.
- `xlsx-*.js` at ~429.19 kB raw / ~142.94 kB gzip.
- `jspdf-*.js` at ~379.42 kB raw / ~123.00 kB gzip.
- `BarChart-*.js` at ~384.12 kB raw / ~106.01 kB gzip.

Impact:

- Initial load or admin-route load can regress on low-end mobile networks.
- The project already has `bun run size` and `bun run bundle:shape`; these should be used before deciding whether this is acceptable.

Recommended fix:

- Run `bun run size` and `bun run bundle:shape` after build.
- Verify admin-only libraries (`xlsx`, `jspdf`, charting, html2canvas) are not pulled into respondent routes.
- Add/adjust route-level dynamic imports where bundle-shape output shows leakage.

### 7. Local Node version does not match documented production runtime

**Severity:** Medium for local verification
**Area:** Environment/deployment parity

Evidence:

- Local `node --version` returned `v22.16.0`.
- Repo guidance, `.nvmrc`, and Railway config expect Node `24.15.0` / Node 24.

Impact:

- A local `node server-node.mjs` smoke would not be production-equivalent.
- Runtime differences can hide SSR or package-resolution issues.

Recommended fix:

- Install/use Node 24.15.0 for production-equivalent smoke.
- Then run: `bun run build`, start `node server-node.mjs` with `PORT=4173 HOSTNAME=127.0.0.1`, and run `BASE_URL=http://127.0.0.1:4173 bun run smoke`.

## Low-priority findings and review notes

### 8. Some form labels are not explicitly associated with inputs

**Severity:** Low
**Area:** Accessibility polish

Examples:

- `src/routes/reset-password.tsx` renders `Label` before password inputs without `htmlFor`/`id` linkage.
- `src/components/survey/SurveyRunnerView.tsx` contact fields do the same for name/email/organization.

Impact:

- Screen readers usually still infer nearby text poorly or inconsistently; explicit labels are more robust.
- Clicking label text may not focus the associated input.

Recommended fix:

- Add stable IDs and pair `Label htmlFor="..."` with matching input `id`.

### 9. Local resume-token TTL is shorter than database stale-response expiry

**Severity:** Low / product decision
**Area:** Resume UX
**Status:** Resolved — `RESUME_TOKEN_TTL_MS` aligned to 30 days (2026-05-25)

Evidence at time of audit:

- `src/lib/resume-token-storage.ts` used a 1-day localStorage TTL.
- `supabase/migrations/20260517090000_expire_stale_responses.sql` expires in-progress responses after 30 days.

Resolution:

- `RESUME_TOKEN_TTL_MS` changed from `DAY_MS` (24 h) to `THIRTY_DAYS_MS` (30 days), matching the database expiry.
- `setStoredResumeToken` now derives expiry from the exported constant (`RESUME_TOKEN_TTL_MS`) rather than the private variable, making it the single source of truth.
- The TTL is still a sliding window: each successful `getStoredResumeToken` call resets the clock.
- Test description updated from "24h sliding TTL" to "30-day sliding TTL"; all 4 tests pass.

## Positive findings

- **Server/client boundary:** no service-role imports were found in client-rendered `.tsx` files. The Supabase admin client is confined to server modules/routes.
- **Security posture:** production security assertions require Turnstile and reject bypass in production; CSP uses a nonce; server errors are normalized into a localized static error page.
- **Rate limiting:** Redis-backed token bucket has an in-memory fallback for local/test; public API is well-covered by tests.
- **Admin exports:** the streaming CSV/XLSX and codebook export paths have substantial protocol/shape coverage and generally paginate instead of relying on Supabase's default 1,000-row cap.
- **CI topology:** PR/build/a11y/smoke/nightly workflows are split sensibly, with smoke kept as a main-branch deploy gate per documented tradeoff.

## Recommended next steps

1. **Fix or re-spec SurveyRunner navigation/focus behavior.** Start with `goNext` skip logic and `useFocusReturn` focus policy.
2. **Normalize line endings.** Add `.gitattributes` and re-run `format:check`/`lint` on a fresh checkout.
3. **Re-run the full gate on a clean LF checkout.** Include the full Vitest suite in CI; locally continue excluding `codebook-xlsx.test.ts` only if the known hang reproduces.
4. **Paginate or disclose `getAnalyticsReport` row limits.** Avoid silent undercounting in admin reports.
5. **Run production-equivalent smoke with Node 24.** This was not completed locally due the Node 22 runtime present in the shell.
6. **Run bundle-budget tooling after build.** Confirm the large Vite chunks are either expected/admin-only or split further.
