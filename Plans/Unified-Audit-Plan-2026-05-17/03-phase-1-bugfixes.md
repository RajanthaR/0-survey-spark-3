# Phase 1 — Bug fixes & test stabilisation

## Goal

`bun run test` is **green**, `bun run lint` reports **0 errors** (warnings
allowed), and the `adminLoginGuard` lockout actually locks out.

## Why now

P0 added the CI gate; with the gate in place we can land non-formatting
fixes safely. The test suite is **51 / 534 failing** today — every
subsequent phase that touches `SurveyRunner` or admin code will collide
with these failures unless we resolve them first.

## Sources

- `audits/04-testing.md` (T-1 to T-5)
- `audits/06-code-quality.md` (Q-1 to Q-5)
- `audits/13-codex-parity-supplement.md` (S-15 — `adminLoginGuard` bug)
- `audits/01-content.md` (C-1, C-2)
- `audits/08-i18n.md` (I-1, I-2, I-3)
- `Codex-audits/05-testing-audit.md`, `07-code-quality-audit.md`,
  `08-security-privacy-audit.md`, `09-multilanguage-i18n-audit.md`

## Codex Sessions

### Session 1.1 — `react-hooks/rules-of-hooks` violation (XS, ~15 min)

```text
Goal: Fix the conditional useState call in FilteredPreviewExtras.tsx.

Read:
- src/components/admin/FilteredPreviewExtras.tsx:1-200

Edit:
- Move `const [expandedId, setExpandedId] = useState<string | null>(null);`
  above the early return at line 118.

Verification:
- bun run lint src/components/admin/FilteredPreviewExtras.tsx exits 0.
- bun run test src/components/admin (any tests touching this file) pass.

Commit: "fix(admin): hoist useState above early return in
FilteredPreviewExtras (audits/06-code-quality.md Q-1)".
```

### Session 1.2 — `adminLoginGuard` lockout bug (S, ~1.5h, **HIGH PRIORITY**)

```text
Goal: Make the lockout actually lock out. Currently the `check` and `fail`
paths use independent buckets so prior failures do not block future checks.

Read:
- src/lib/admin-login-guard.functions.ts (full file)
- src/lib/rate-limit.server.ts (full file)
- src/routes/admin.tsx (find every adminLoginGuard call site)
- audits/13-codex-parity-supplement.md (S-15)

Edits:
1. Add a `peek(key, cfg): { tokens, retrySec }` export to
   src/lib/rate-limit.server.ts that returns bucket state without
   mutating it.
2. Rewrite admin-login-guard.functions.ts so:
   - `check` uses peek() against a single shared bucket; throws 429
     when peek().tokens === 0.
   - `fail` consumes one token from the same shared bucket.
3. Wire the call so the server-fn that performs the actual sign-in
   invokes `check` server-side **before** calling Supabase auth, so a
   client that skips the guard cannot bypass it.

Tests (write before edits, TDD):
- Add src/lib/__tests__/admin-login-guard.lockout.test.ts that:
  a) reports 5 fails for `a@b.com|1.2.3.4`,
  b) calls `check` with the same key,
  c) expects a 429.
- Add a test that `check` does NOT consume tokens (5 checks in a row work).
- Add a test that successful sign-in does NOT consume capacity.

Verification:
- bun run typecheck exits 0.
- bun run test src/lib/__tests__/admin-login-guard exits 0.
- bun run lint src/lib/admin-login-guard.functions.ts exits 0.

Commit: "fix(security): admin login lockout actually enforces 5/15min
(audits/13-codex-parity-supplement.md S-15)".
```

### Session 1.3 — SurveyRunner motion-contract regressions (M, ~3h)

```text
Goal: Reconcile ~25 failing tests that assert
`{ duration: 0.25 }` while the live transition is now a spring.

Read:
- src/components/survey/QuestionView.tsx (whole file)
- src/components/__tests__/SurveyRunner.questionCountAnimation.test.tsx
- src/components/__tests__/SurveyRunner.backAnnouncements.a11y.test.tsx
- src/components/__tests__/SurveyRunner.nextAnnouncements.a11y.test.tsx
- src/components/__tests__/SurveyRunner.progressAnnouncements.e2e.test.tsx
- src/components/__tests__/SurveyRunner.rapidBackAnnouncements.a11y.test.tsx
- src/components/__tests__/SurveyRunner.progressStatsI18n.e2e.test.tsx
- src/components/__tests__/SurveyRunner.questionCountAnimation.test.tsx
- src/components/__tests__/SurveyRunner.saveExitAfterBack.e2e.test.tsx
- src/components/__tests__/SurveyRunner.telNumRangeGating.e2e.test.tsx

Decision (ASK HUMAN if uncertain):
- Option A: Revert QuestionView transition to `{ duration: 0.25 }`
  (predictable for SR announcement timing).
- Option B: Keep the spring; update every failing test to assert
  `{ type: "spring", stiffness: 320, damping: 32, mass: 0.6 }`.

If A: minimum diff in QuestionView.tsx; tests stay.
If B: write a `expectMotionTransition(spring|tween)` helper in
src/test/setup.ts and update all failing tests to use it.

Tests must NOT be skipped or weakened. The contract is intentional.

Verification:
- bun run test src/components/__tests__/SurveyRunner.* passes 100%.
- Manual a11y check via Computer Use: VoiceOver announces every Next.

Commit: "fix(SurveyRunner): align motion transition with announcement contract".
```

### Session 1.4 — TanStack Start AsyncLocalStorage in unit tests (M, ~2h)

```text
Goal: 9 turnstileGuard tests fail with "No Start context found in
AsyncLocalStorage". Wrap calls in a Start context harness OR extract the
guard logic into a plain helper.

Read:
- src/lib/__tests__/responses.turnstileGuard.test.ts (whole file)
- src/lib/responses.functions.ts:1-100
- src/lib/turnstile.server.ts (whole file)
- node_modules/@tanstack/start-storage-context/src/async-local-storage.ts
  (just the exports; do not edit)

Decision:
- Prefer Option B: extract `verifyTurnstile` orchestration into a plain
  function `applyStartGuards({ ip, turnstileToken, bypassRequested })`
  that returns either ok or throws. Then the server-fn handler is a thin
  shell. The test calls applyStartGuards directly with a deterministic ip.

If Option A is necessary (some tests want to exercise the middleware
chain), add src/test/start-context.ts exporting a `withStartContext()`
helper using TanStack's test utilities.

Verification:
- bun run test src/lib/__tests__/responses.turnstileGuard.test.ts passes.
- bun run typecheck exits 0.
- The middleware chain still functions in dev (bun run dev + smoke).

Commit: "test(security): unit-test Turnstile guard without Start runtime".
```

### Session 1.5 — Codebook XLSX freeze pane regression (XS, ~15 min)

```text
Goal: Re-add !freeze.ySplit = 1 to the codebook XLSX writer.

Read:
- src/lib/exports-extended.ts (find buildCodebookXlsx)
- src/lib/__tests__/codebook-xlsx.test.ts:100-130

Edit: Re-add `worksheet["!freeze"] = { ySplit: 1 };` after the header
row write. (SheetJS writes this as `freeze pane`.)

Verification:
- bun run test src/lib/__tests__/codebook-xlsx.test.ts passes.

Commit: "fix(exports): restore freeze pane on codebook header row
(audits/04-testing.md T-5)".
```

### Session 1.6 — Inline SI/TA literals → dictionaries (M, ~2h)

```text
Goal: Move 5 inline localized literals into dictionaries so the
no-inline-localized-labels.test.ts and no-restricted-syntax rule pass.

Read:
- src/lib/__tests__/no-inline-localized-labels.test.ts
- src/lib/__tests__/no-hardcoded-question-strings.test.ts
- src/components/SurveyRunner.tsx:510-525   # +N skipped pill
- src/components/survey/ResponseVisualSummary.tsx:1-40
- src/lib/analytics-report-i18n.ts:1-60
- src/lib/exports-extended.ts:70-90  # likely just a comment
- src/routes/admin.tsx:2460-2480

Edits:
1. Add UI.skipped to src/lib/i18n.tsx with EN/SI/TA values.
2. SurveyRunner.tsx:517 → use pickText(UI.skipped, lang).
3. ResponseVisualSummary.tsx:19 → move inline si literal to a local
   dictionary at the top of the file (or into UI).
4. analytics-report-i18n.ts:40 → either move the SI/TA validation message
   into UI, OR add this file to the eslint allowlist (it's a dictionary
   already). Prefer allowlist + rename to src/lib/i18n/analytics-report.ts.
5. exports-extended.ts:79 → if it's a doc-comment example, replace with
   placeholders like "[SECTION 1] role". If it's runtime code, move to
   the survey-export i18n triple.
6. admin.tsx:2468 → move "ඉංග්‍රීසි" / "ஆங்கிலம்" labels to UI.

Verification:
- bun run test src/lib/__tests__/no-inline-localized-labels.test.ts passes.
- bun run test src/lib/__tests__/no-hardcoded-question-strings.test.ts passes.
- bun run lint src/components src/lib src/routes/admin.tsx exits 0 for
  no-restricted-syntax.

Commit: "i18n: route remaining SI/TA literals through dictionaries".
```

### Session 1.7 — Stale TA-TODO comments + dictionary parity (XS, ~15 min)

```text
Goal: Update phase-1.ts:7 and phase-3.ts:7 to reflect that Tamil is
populated. Add a parity test.

Edits:
1. src/surveys/phase-1.ts:7 — replace "TA = TODO (falls back to EN in UI)"
   with "TA reviewed by <translator> on <date>".  Ask human for the
   translator's name + date if unknown; otherwise leave a placeholder
   "<TODO: translator + date>" and open a docs issue.
2. src/surveys/phase-3.ts:7 — same.
3. Add src/lib/__tests__/i18n-parity.test.ts asserting that for every
   LocalizedString in src/lib/i18n.tsx UI export, all of {en, si, ta}
   are present and non-empty.

Verification:
- bun run test src/lib/__tests__/i18n-parity.test.ts passes (or fails
  with the 1 missing key — fix it then commit).

Commit: "i18n: dictionary parity test + clarify TA review status".
```

### Session 1.8 — `react-hooks/exhaustive-deps` warning (XS, ~15 min)

```text
Goal: Resolve the missing-dependency warning at SurveyRunner.tsx:448.

Read:
- src/components/SurveyRunner.tsx:430-470

Edit:
- Inspect the useEffect; either include `current` in the deps array OR
  add an eslint-disable-next-line with a comment explaining why
  (e.g. "intentional: only re-run when stage changes; current is read
  via ref to avoid stale-closure flicker").

Verification:
- bun run lint src/components/SurveyRunner.tsx exits 0.

Commit: "chore(SurveyRunner): document or fix exhaustive-deps warning".
```

### Session 1.9 — Drop unused eslint-disable directives (XS, ~10 min)

```text
Goal: Remove the 9 unused eslint-disable comments lint flagged.

Edits:
- bun run lint -- --report-unused-disable-directives | filter
- Remove each one.

Verification:
- bun run lint reports zero "Unused eslint-disable directive" warnings.

Commit: "chore(lint): drop unused eslint-disable directives".
```

## Verification (whole phase)

```sh
bun run typecheck       # exits 0
bun run lint            # 0 errors, ≤ 10 warnings (mostly react-refresh)
bun run test            # 0 failures
bun run build           # exits 0
```

## Done criteria

- [ ] 1.1 React Hook ordering bug fixed.
- [ ] 1.2 `adminLoginGuard` lockout works — new test asserts it.
- [ ] 1.3 SurveyRunner motion / announcement tests reconciled.
- [ ] 1.4 Turnstile guard unit-testable without Start runtime.
- [ ] 1.5 Codebook XLSX freeze pane restored.
- [ ] 1.6 Inline SI/TA literals in dictionaries; guardrail tests green.
- [ ] 1.7 Stale TA TODO comments replaced; parity test in place.
- [ ] 1.8 SurveyRunner exhaustive-deps resolved.
- [ ] 1.9 Unused disables removed.
- [ ] CI green on a re-run of `pr.yml`.

## What this unlocks

- P2 security work lands on a green test suite.
- P3 refactors get behaviour-locking tests.
- The `adminLoginGuard` fix is a **production-blocking bug** — call out
  to the human if any session in 1.2 takes longer than 4h to ship.
