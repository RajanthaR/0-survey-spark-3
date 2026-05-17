# P3 Wave-1 — 4 parallel prompts

Fire each `## Prompt N.M` section as a **separate** Codex agent.

**Depends on:** 3.1 merged (screenshots baseline available).
**Blocks:** 3.2 (admin split) and wave-2 (3.4, 3.6).

Conflict matrix — all 4 touch disjoint subtrees, fully parallel:

| Prompt | Owns | Touches |
| --- | --- | --- |
| 3.3 | SurveyRunner hooks | `src/components/SurveyRunner.tsx`, `src/components/survey/hooks/*` (new) |
| 3.5 | de-dup `isAnswered` | `src/lib/survey-logic.ts`, `src/components/survey/validation.ts` |
| 3.7 | `LocalizedString` typing | `src/surveys/types.ts`, `src/lib/i18n.tsx` |
| 3.8 | ARCHITECTURE.md | `docs/ARCHITECTURE.md` (new) |

---

## Prompt 3.3 — Extract SurveyRunner hooks

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR per hook (5 small PRs stacked) OR one large PR if the
       agent can keep the diff < 600 lines per file.

**Goal:** `SurveyRunner.tsx` becomes ≤ 400 lines; the autosave, resume,
stage machine, focus, swipe, and keyboard concerns each live in their
own hook under `src/components/survey/hooks/`.

**Audit ref:** `audits/05-architecture.md` A-1.

### TODO

1. Read first:
   - `src/components/SurveyRunner.tsx` (whole file)
   - `src/components/survey/*` (siblings)
   - All `src/components/__tests__/SurveyRunner.*.test.tsx` files —
     these pin behaviour.
   - `Plans/Unified-Audit-Plan-2026-05-17/screenshots/pre/` (baseline)
2. Confirm `bun run test` is green before any edit. If not, STOP.
3. Extract, in this order (one PR each, stacked):
   - `useStageMachine(survey, answers)` →
     `{ stage, advance, back, save }`
   - `useAutoSave(answers, opts)` — handles debounce, `pagehide`,
     `visibilitychange`, `sendBeacon` flush.
   - `useResumeToken(slug)` → `{ token, persist, clear }`.
   - `useSwipeNav(refs, opts)` → handlers.
   - `useKeyboardNav(refs)` → handlers.
4. For each hook, add unit tests in
   `src/components/survey/hooks/__tests__/use<Name>.test.ts(x)`.
5. Update `SurveyRunner.tsx` to compose the hooks; behaviour must be
   identical.
6. Re-run `bun run screenshots` capturing into
   `Plans/Unified-Audit-Plan-2026-05-17/screenshots/post-p3-3/`.
   Eyeball-diff against `pre/`; flag any non-motion diff.

### Verification

```bash
bun run test src/components/__tests__/SurveyRunner   # 100% pass
bun run test src/components/survey/hooks/__tests__   # all new tests pass
bun run typecheck
bun run lint src/components/survey
wc -l src/components/SurveyRunner.tsx                 # <= 400
```

### Commit & PR

- Branch: `refactor/surveyrunner-hooks` (or one per hook)
- Commit: `refactor(SurveyRunner): extract use<Name> [3.3.<n>]`
- PR body refs `audits/05-architecture.md` A-1 and links the screenshot
  diff folder.

### Stop conditions

- If any existing test fails, **revert that hook** and STOP. Behaviour
  parity is the contract.
- If extracting a hook requires changing the props of a sibling
  component, that's scope creep — open a separate issue and skip the
  hook for now.

---

## Prompt 3.5 — De-dup `isAnswered`

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. ≤ 30 lines diff.

**Goal:** `isAnswered` should have one source of truth.

**Audit ref:** `audits/05-architecture.md` A-4.

### TODO

1. `grep -rn "isAnswered" src/` to find both implementations.
2. Read each implementation; they should be functionally equivalent.
   If they differ, the one in `src/lib/survey-logic.ts` wins (closer to
   the survey domain).
3. Delete the duplicate (`src/components/survey/validation.ts` is the
   likely candidate).
4. Re-export from `survey-logic.ts` if the validation module needs to
   keep a named export.
5. Update imports. TS will catch most.

### Verification

```bash
bun run typecheck
bun run test
grep -rn "function isAnswered\\|const isAnswered" src/ | wc -l   # expect 1
```

### Commit & PR

- Branch: `refactor/dedup-is-answered`
- Commit: `refactor(survey-logic): single isAnswered source [3.5]`
- PR body refs `audits/05-architecture.md` A-4.

---

## Prompt 3.7 — Tighten `LocalizedString` typing

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. May surface follow-up compile errors — see stop
       condition.

**Goal:** Missing translations become compile errors.

**Audit ref:** `audits/05-architecture.md` A-10.

### TODO

1. Read first:
   - `src/surveys/types.ts`
   - `src/lib/i18n.tsx` (`pickText` signature)
2. In `src/surveys/types.ts`, confirm `LocalizedString` is:
   ```ts
   export type Lang = "en" | "si" | "ta";
   export type LocalizedString = { en: string; si: string; ta: string };
   ```
   If any field is optional, make all three required.
3. In `pickText`, tighten the signature so the first arg is
   `LocalizedString` (not `unknown`) and the second is `Lang`.
4. Run `bun run typecheck` — there will be a wave of new errors at
   call sites that were silently falling back. If the count is **≤ 30**,
   fix them in this PR. If **> 30**, STOP and split into:
   - Step A: ship the type tightening behind a separate exported
     type (`StrictLocalizedString`) with the old `LocalizedString`
     deprecated.
   - Step B (separate prompt, not auto-spawned): migrate call sites.
5. Do not weaken any other type to accommodate.

### Verification

```bash
bun run typecheck
bun run test
```

### Commit & PR

- Branch: `types/strict-localized-string`
- Commit: `types(i18n): missing translations are compile errors [3.7]`
- PR body refs `audits/05-architecture.md` A-10 and reports the
  number of call sites fixed.

### Stop conditions

- If the strict type causes > 30 new TS errors, switch to the
  deprecation path described in step 4.

---

## Prompt 3.8 — ARCHITECTURE.md

ROLE: You are a senior engineer on survey-spark-3.
MODE: Execute the TODO below. Do not propose a plan first.
SCOPE: One PR. Documentation only.

**Goal:** `docs/ARCHITECTURE.md` answers "where does X live?" for the
next human or agent contributor.

**Audit ref:** `audits/05-architecture.md` A-9.

### TODO

1. Read enough source to write accurately (do NOT re-summarise the
   audits — describe the present state):
   - `src/router.tsx`
   - `src/routes/*` (list files, note generated `routeTree.gen.ts`)
   - `src/lib/*.functions.ts` (server fns)
   - `src/integrations/supabase/*`
   - `src/surveys/*`
   - `src/lib/i18n.tsx`
   - `wrangler.jsonc`
2. Create `docs/ARCHITECTURE.md` with sections:
   - Route map (a small table of route → owns → notes)
   - Server-fn boundaries (responses, admin.{auth,stats,exports})
   - Supabase access pattern (admin client server-only, anon client
     RLS-bound)
   - Survey definition contract (`LocalizedString`, `Question`, `Survey`)
   - Lazy chunks (charts, codebook, exports)
   - Where new features go (decision tree)
   - Generated files (do not hand-edit; list them)
3. Link from `README.md` (add to the existing docs section).

### Verification

```bash
test -f docs/ARCHITECTURE.md
grep -q "ARCHITECTURE" README.md
bunx --bun markdownlint-cli docs/ARCHITECTURE.md   # if installed
```

### Commit & PR

- Branch: `docs/architecture`
- Commit: `docs(architecture): contributor + agent map [3.8]`
- PR body refs `audits/05-architecture.md` A-9.

### Stop conditions

- Do not include code samples > 10 lines — link to the source instead.
- Do not duplicate content already in `Plans/` or `audits/`.
