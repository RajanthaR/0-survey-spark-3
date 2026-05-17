# P1 Wave-1 — 7 parallel prompts

Fire each `## Prompt N.M` section as a **separate** Codex agent. Each is
a complete plan; copy only that section into a fresh chat.

**Depends on:** P0 fully merged (CI gate in place).
**Blocks:** `1.8-exhaustive-deps.md` blocks until 1.3 lands.
            `1.6-inline-literals.md` blocks until 1.8 lands.

Conflict matrix (the agents below touch disjoint files, so all 7 can run
concurrently):

| Prompt | Owns | Touches |
| --- | --- | --- |
| 1.1 | hook ordering bug | `FilteredPreviewExtras.tsx` |
| 1.2 | adminLoginGuard | `admin-login-guard.functions.ts`, `rate-limit.server.ts` |
| 1.3 | motion contract | `QuestionView.tsx`, `SurveyRunner.*.test.tsx` |
| 1.4 | turnstile guard unit-test | `responses.functions.ts`, `turnstile.server.ts` |
| 1.5 | XLSX freeze pane | `exports-extended.ts` (single line), test |
| 1.7 | TA-TODO comments + parity | `surveys/phase-1.ts`, `surveys/phase-3.ts`, new parity test |
| 1.9 | unused eslint-disables | many files but only deletions |

---

## Prompt 1.1 — Hoist `useState` above early return

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. ≤ 15 lines diff.

**Goal:** Fix the `react-hooks/rules-of-hooks` violation in
`FilteredPreviewExtras.tsx`.

**Audit ref:** `audits/06-code-quality.md` Q-1.

### TODO

1. Read `src/components/admin/FilteredPreviewExtras.tsx:1-200`.
2. Locate the early-return around line 118.
3. Hoist `const [expandedId, setExpandedId] = useState<string | null>(null);`
   (and any sibling `useState` calls between the return and the original
   position) **above** the early-return.
4. Leave all other code untouched.

### Verification

```bash
bun run lint src/components/admin/FilteredPreviewExtras.tsx
bun run typecheck
bun run test src/components/admin
```

### Commit & PR

- Branch: `fix/hooks-filtered-preview-extras`
- Commit: `fix(admin): hoist useState above early return in FilteredPreviewExtras [1.1]`
- PR body refs `audits/06-code-quality.md` Q-1.

---

## Prompt 1.2 — Fix `adminLoginGuard` lockout (HIGH PRIORITY)

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. Includes a new test file.

**Goal:** Make the lockout actually lock out. Today the `check` and `fail`
paths use independent buckets, so prior failures never block future
checks.

**Audit ref:** `audits/13-codex-parity-supplement.md` S-15.

### TODO

1. Read first:
   - `src/lib/admin-login-guard.functions.ts` (full file, 44 lines)
   - `src/lib/rate-limit.server.ts` (full file)
   - `src/routes/admin.tsx` — find every `adminLoginGuard` call site
   - `src/lib/__tests__/admin-login-guard.*` (if any exist)
2. Add a `peek(key, cfg): { tokens: number; retrySec: number }` export
   to `src/lib/rate-limit.server.ts` that returns bucket state **without
   mutating** it.
3. Rewrite `admin-login-guard.functions.ts`:
   - `check`: call `peek` against a **single shared bucket** keyed by
     `${email}|${ip}`; throw 429 when `peek().tokens === 0`.
   - `fail`: consume one token from the **same** bucket.
   - Delete the `peek:` prefixed bucket name and the `adminLoginPeek`
     rule.
4. Wire the check server-side: the server-fn that performs the actual
   sign-in must invoke `check` **before** calling Supabase auth, so a
   non-cooperating client cannot bypass the guard.
5. Write **before** editing the implementation:
   `src/lib/__tests__/admin-login-guard.lockout.test.ts` asserting:
   - 5 fails for `a@b.com|1.2.3.4` → next `check` throws 429.
   - 5 checks in a row do **not** consume capacity.
   - A successful sign-in does not consume capacity.
   - The lockout window is 15 minutes (use vi.useFakeTimers).

### Verification

```bash
bun run typecheck
bun run test src/lib/__tests__/admin-login-guard
bun run lint src/lib/admin-login-guard.functions.ts src/lib/rate-limit.server.ts
```

### Commit & PR

- Branch: `security/admin-login-guard-lockout`
- Commit: `fix(security): admin login lockout actually enforces 5/15min [1.2]`
- PR body refs `audits/13-codex-parity-supplement.md` S-15.

### Stop conditions

- If wiring the check server-side requires changing more than 2 callers
  in `admin.tsx`, STOP and report — the route shape may have drifted.

---

## Prompt 1.3 — SurveyRunner motion-contract regressions

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. Touches `QuestionView.tsx` OR several test files —
       decide before editing (see step 2).

**Goal:** Reconcile ~25 failing tests that assert `{ duration: 0.25 }`
while the live transition is now a spring.

**Audit ref:** `audits/04-testing.md` T-2 / T-3.

### TODO

1. Read first:
   - `src/components/survey/QuestionView.tsx` (whole file)
   - `src/components/__tests__/SurveyRunner.questionCountAnimation.test.tsx`
   - `src/components/__tests__/SurveyRunner.backAnnouncements.a11y.test.tsx`
   - `src/components/__tests__/SurveyRunner.nextAnnouncements.a11y.test.tsx`
   - `src/components/__tests__/SurveyRunner.progressAnnouncements.e2e.test.tsx`
   - `src/components/__tests__/SurveyRunner.rapidBackAnnouncements.a11y.test.tsx`
   - `src/components/__tests__/SurveyRunner.progressStatsI18n.e2e.test.tsx`
   - `src/components/__tests__/SurveyRunner.saveExitAfterBack.e2e.test.tsx`
   - `src/components/__tests__/SurveyRunner.telNumRangeGating.e2e.test.tsx`
2. **Decide before editing** (write the decision in the PR description):
   - **Option A** — revert `QuestionView` transition to
     `{ duration: 0.25 }` for predictable SR announcement timing.
   - **Option B** — keep the spring; update every failing test to
     assert `{ type: "spring", stiffness: <N>, damping: <N>, mass: <N> }`
     via a new helper `expectMotionTransition(spring|tween)` in
     `src/test/setup.ts`.
   - Default to **Option A** unless the spring is clearly more correct
     visually; explain in the PR body.
3. If Option B, add the helper before touching test files; reuse it
   across all 8 specs.
4. Tests must NOT be skipped, deleted, or weakened. The contract is
   intentional.

### Verification

```bash
bun run test src/components/__tests__/SurveyRunner   # all pass
bun run typecheck
bun run lint src/components/survey/QuestionView.tsx
```

### Commit & PR

- Branch: `fix/surveyrunner-motion-contract`
- Commit: `fix(SurveyRunner): align motion transition with announcement contract [1.3]`
- PR body refs `audits/04-testing.md` T-2 / T-3 and states Option A vs B.

---

## Prompt 1.4 — Unit-test Turnstile guard without Start runtime

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. Refactor + tests.

**Goal:** 9 turnstileGuard tests fail with "No Start context found in
AsyncLocalStorage". Extract the guard logic so it is unit-testable.

**Audit ref:** `audits/04-testing.md` T-1.

### TODO

1. Read first:
   - `src/lib/__tests__/responses.turnstileGuard.test.ts` (whole file)
   - `src/lib/responses.functions.ts:1-150`
   - `src/lib/turnstile.server.ts` (whole file)
2. Extract a plain function:
   ```ts
   // src/lib/turnstile.server.ts (or new src/lib/respondent-guards.ts)
   export async function applyStartGuards(ctx: {
     ip: string;
     turnstileToken: string | undefined;
     bypassRequested: boolean;
   }): Promise<{ ok: true } | never>;
   ```
   Move the orchestration of `rateLimit` + `verifyTurnstile` into it.
3. Refactor the `createServerFn` handlers in `responses.functions.ts` to
   become thin shells that pull `ip` via `getClientIp()` and then call
   `applyStartGuards`.
4. Update the test file to call `applyStartGuards` directly with a
   deterministic IP and bypass flag. Drop the broken Start-context
   harness.
5. Tests must NOT be skipped or weakened — they verify guard semantics.

### Verification

```bash
bun run test src/lib/__tests__/responses.turnstileGuard.test.ts
bun run typecheck
bun run dev   # smoke: visit /, then /s/phase-1; guard still rejects bad tokens
```

### Commit & PR

- Branch: `test/turnstile-guard-extractable`
- Commit: `test(security): unit-test Turnstile guard without Start runtime [1.4]`
- PR body refs `audits/04-testing.md` T-1.

---

## Prompt 1.5 — Restore codebook XLSX freeze pane

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. ≤ 5 lines diff.

**Goal:** Re-add `worksheet["!freeze"] = { ySplit: 1 }` to the codebook
XLSX writer so the header row is frozen.

**Audit ref:** `audits/04-testing.md` T-5.

### TODO

1. Read `src/lib/exports-extended.ts` — find `buildCodebookXlsx` or
   equivalent.
2. Read `src/lib/__tests__/codebook-xlsx.test.ts:100-130` to confirm the
   expected assertion shape.
3. After the header row is written, add:
   ```ts
   worksheet["!freeze"] = { ySplit: 1 };
   ```
4. If SheetJS uses a different freeze-pane API in the installed version
   (`!fpx`/`!fpy`), use whatever the test asserts.

### Verification

```bash
bun run test src/lib/__tests__/codebook-xlsx.test.ts
bun run typecheck
```

### Commit & PR

- Branch: `fix/codebook-xlsx-freeze`
- Commit: `fix(exports): restore freeze pane on codebook header row [1.5]`
- PR body refs `audits/04-testing.md` T-5.

---

## Prompt 1.7 — Dictionary parity test + clarify TA review status

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. New test file + 2 comment-only edits.

**Goal:** Replace stale "TA = TODO" comments and add a parity test that
fails if any UI dictionary key is missing EN / SI / TA.

**Audit refs:** `audits/01-content.md` C-1, `audits/08-i18n.md` I-1 / I-3.

### TODO

1. Read `src/surveys/phase-1.ts:1-15`, `src/surveys/phase-3.ts:1-15`.
2. Replace the "TA = TODO (falls back to EN in UI)" comment in both
   files with:
   ```
   // TA reviewed by <TODO: translator + date>; see audits/01-content.md C-1.
   ```
   (Leave a literal `<TODO: …>` placeholder for the human to fill in.)
3. Create `src/lib/__tests__/i18n-parity.test.ts` that:
   - Imports `UI` from `src/lib/i18n.tsx`.
   - Walks every value; if a value matches `{ en, si, ta }` shape,
     asserts all three are non-empty strings.
   - Lists offending keys in the failure message so the next prompt
     (1.6) can fix them.
4. If the parity test fails immediately, **do not** fix the underlying
   gaps in this prompt — that is 1.6's job. Instead, file a comment in
   the PR body listing the offending keys.

### Verification

```bash
bun run test src/lib/__tests__/i18n-parity.test.ts
bun run typecheck
```

### Commit & PR

- Branch: `i18n/parity-test-and-ta-comments`
- Commit: `i18n: dictionary parity test + clarify TA review status [1.7]`
- PR body refs `audits/01-content.md` C-1 and `audits/08-i18n.md` I-1.

---

## Prompt 1.9 — Drop unused eslint-disable directives

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. Deletions only.

**Goal:** Remove the unused `eslint-disable` comments flagged by ESLint.

**Audit ref:** `audits/06-code-quality.md` Q-5.

### TODO

1. Run `bun run lint -- --report-unused-disable-directives -o /tmp/disables.json -f json`.
2. Parse the JSON; for each finding, delete the offending comment.
3. Do **not** delete an `eslint-disable` that is still active on at
   least one line — the report only flags ones that have become unused.
4. If the same line had both an active and an unused disable comment,
   only the unused one comes out.

### Verification

```bash
bun run lint -- --report-unused-disable-directives 2>&1 | grep "Unused" || echo OK
bun run typecheck
bun run test
```

### Commit & PR

- Branch: `chore/drop-unused-eslint-disables`
- Commit: `chore(lint): drop unused eslint-disable directives [1.9]`
- PR body refs `audits/06-code-quality.md` Q-5.

### Stop conditions

- If a deletion would re-introduce a real lint error (because the
  directive was masking it), STOP and report the file + rule — that is
  not in scope for this prompt.

---

## Wave gate (don't proceed until ALL 7 PRs above are merged)

After this wave is fully merged:

1. Confirm `bun run test` failure count has dropped by ~30 tests.
2. Confirm `bun run lint` no longer reports `react-hooks/rules-of-hooks`.
3. Confirm the new `i18n-parity` test exists and (likely) fails — that
   surfaces the keys 1.6 needs to fix.
4. Proceed to `1.8-exhaustive-deps.md`.
