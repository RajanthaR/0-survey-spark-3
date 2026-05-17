# Phase 3 — Architecture (splits + extracted hooks)

## Goal

`src/routes/admin.tsx` is a thin route shell ≤ 200 lines.
`src/components/SurveyRunner.tsx` is ≤ 400 lines with hooks extracted.
The Supabase filter chain is typed (no more `as any`).

## Why now

P0–P2 left a green test suite. P3 is the largest diff but produces no
behaviour change — running it on red would be unsafe. Running it before
P4 perf measurements means the bundle splits become measurable.

## Sources

- `audits/05-architecture.md` (A-1 to A-10)
- `audits/03-performance.md` (P-1)
- `audits/06-code-quality.md` (Q-4 — `as any` casts)
- `Codex-audits/06-architecture-audit.md`

## Codex Sessions

### Session 3.1 — Behaviour-locking screenshots (S, ~1h)

```text
Goal: Capture pre-refactor visual + DOM baseline so 3.2 + 3.3 don't
regress.

Steps (use Computer Use):
1. bun run dev
2. For lang in [en, si, ta]:
   - http://localhost:5173/ → screenshot → Plans/Unified-Audit-Plan-2026-05-17/screenshots/pre/<lang>-home.png
   - /s/phase-1 → walk consent → first 3 questions → review → contact → done.
     Screenshot each stage.
   - /admin → login → screenshot stats, filters, response list, exports panel.
3. Save the screenshots tree.

These are the diff target for the post-refactor pass.
```

### Session 3.2 — Split `admin.tsx` by feature (XL, ~1d, **GPT-5.5 Pro**)

```text
Goal: admin.tsx becomes a 200-line route shell. Per-feature panels live
under src/routes/admin/* as child routes (or under src/components/admin/*
as panels rendered by admin.tsx).

Read (loadable in one 400K context):
- src/routes/admin.tsx (whole file ~4099 lines)
- src/routes/admin/charts-lazy.tsx (existing chart split)
- src/routes/admin/LoginPanel.tsx
- src/components/admin/* (existing panels)
- src/lib/admin.shared.server.ts
- src/lib/admin.stats.functions.ts
- src/lib/admin.exports.functions.ts
- audits/05-architecture.md A-2
- Codex-audits/06-architecture-audit.md
- All existing tests under src/components/admin/__tests__ and
  src/routes/__tests__ (if any).

Plan (write to TODO list before editing):
1. Identify per-feature panels in admin.tsx:
   - Auth bootstrap + login
   - Filters + survey selector
   - Stats overview cards + dropoff chart
   - Response list (with pagination)
   - Response detail drawer
   - Exports (all-valid, filtered, codebook, ZIP, validation)
   - Reports (analytics report panel)
   - Alerts panel
   - Live status
2. For each, decide route-vs-panel. Preferred: child routes under
   /admin/{exports,stats,responses,reports,alerts,settings} so each is
   independently lazy-loaded.
3. Move pure helpers into src/lib/admin/* (e.g. `computeDropoff`,
   `detectAlerts`).
4. Keep admin.tsx as a layout file that:
   - Runs the auth check.
   - Renders <Outlet />.
   - Renders the shared sidebar/topbar.
5. After each move, run bun run test to confirm zero regressions.

Constraints:
- No public API change. The /admin URL still loads stats by default.
- Preserve existing route IDs.
- All existing tests stay green.
- Each new route is < 500 lines.

Verification (whole session):
- src/routes/admin.tsx <= 200 lines.
- bun run typecheck && bun run lint && bun run test all green.
- Computer Use: re-take screenshots; diff vs Plans/.../pre/. Allow
  pixel-perfect match (motion can differ; layout must not).
- Bundle: admin route chunk dropped by N% (record in commit message).

Commit strategy:
- One PR per major panel move (auth, filters, stats, responses, exports,
  reports, alerts). Each PR ~300-600 lines. Stack them.
- Final PR: rip out the now-empty sections from admin.tsx.

Risk: this session is the largest in the plan. If GPT-5.5 stalls or
makes contradictory edits, **abort and escalate to human**. Do NOT let
the agent commit if any test goes red.
```

### Session 3.3 — Extract SurveyRunner hooks (L, ~6h)

```text
Goal: SurveyRunner.tsx <= 400 lines, with autosave / resume / stage
machine / focus / swipe extracted to hooks under
src/components/survey/hooks/.

Read:
- src/components/SurveyRunner.tsx (whole file)
- src/components/survey/* (sibling components)
- audits/05-architecture.md A-1

Plan (TDD — pin behaviour first):
1. Confirm 100% of session 3.1's recorded behaviours have a green test.
2. Extract:
   - useStageMachine(survey, answers) → { stage, advance, back, save }
   - useAutoSave(answers, { debounceMs: 1500, flushOn: ['pagehide','visibilitychange'] })
   - useResumeToken(slug) → { token, persist, clear }
   - useSwipeNav(refs, { threshold }) → handlers
   - useKeyboardNav(refs) → handlers
3. Each hook: explicit unit tests in src/components/survey/hooks/__tests__/
4. SurveyRunner becomes the orchestrator: composes hooks + renders.

Verification:
- bun run test src/components/__tests__/SurveyRunner.* still passes.
- bun run test src/components/survey/hooks/__tests__/* exists + passes.
- Computer Use: walk the EN flow + take screenshots; diff = no change.

Commit: one PR per hook + a final PR collapsing SurveyRunner.
```

### Session 3.4 — Type the Supabase filter chain (M, ~2h)

```text
Goal: Drop the 8 `as any` casts in admin.stats.functions.ts +
responses.functions.ts.

Read:
- src/lib/admin.stats.functions.ts (specifically the `applyFilters` helper
  used at lines 391, 409, 431, 474)
- src/lib/responses.functions.ts (lines around 89, 121, 157)
- node_modules/@supabase/postgrest-js/src/types.ts (just for reference)

Edits:
1. Add a typed helper:
   type FilterableQuery<R> = PostgrestFilterBuilder<any, any, R>;
   function applyFilters<R>(q: FilterableQuery<R>, ...): FilterableQuery<R>
2. Update call sites; remove the `as any`.
3. For .insert / .update payloads, define a local type (e.g. ResponseRow)
   and stop casting.

Verification:
- bun run typecheck exits 0.
- bun run lint reports zero @typescript-eslint/no-explicit-any.
- Behaviour unchanged (existing tests).

Commit: "refactor(supabase): typed filter helper, drop as-any casts".
```

### Session 3.5 — De-dup `isAnswered` (XS, ~30m)

```text
Goal: Single source of truth for `isAnswered` between
src/lib/survey-logic.ts and src/components/survey/validation.ts.

Edits:
1. Delete the duplicate in validation.ts.
2. Re-export from survey-logic.ts.
3. Verify no external import path broke (TS will catch).

Commit: "refactor(survey-logic): single isAnswered source".
```

### Session 3.6 — Move admin pure functions under `src/lib/admin/` (S, ~1h)

```text
Goal: Pure helpers used by admin (`computeDropoff`, `detectAlerts`,
section-breakdown helpers) live next to a typed contract, not next to
JSX.

Edits:
1. Create src/lib/admin/{dropoff.ts,alerts.ts,sections.ts}.
2. Move pure functions out of components.
3. Components import the helpers; their tests stay where they are.

Commit: "refactor(admin): pure helpers under src/lib/admin/".
```

### Session 3.7 — Tighten `LocalizedString` typing (S, ~1h)

```text
Goal: Missing translations become compile errors.

Edits:
1. In src/surveys/types.ts, change LocalizedString:
   type LocalizedString = { en: string; si: string; ta: string };
   (already that strict — verify).
2. Add a generic `Translatable<T>` for nested objects.
3. Tighten pickText's signature so the second arg is `Lang` and the
   first is `LocalizedString`, no `unknown`.

Verification:
- bun run typecheck flags any silent fallback at call sites; fix them.

Commit: "types(i18n): missing translations are compile errors".
```

### Session 3.8 — Architecture README (S, ~1h)

```text
Goal: docs/ARCHITECTURE.md so future contributors (human or agent) know
where things live.

Sections:
- Route map (what each /route owns).
- Server-fn boundaries (responses, admin.{auth,stats,exports}).
- Supabase access pattern (admin client only on server, RLS for clients).
- Survey definition contract (LocalizedString, Question, Survey).
- Lazy chunks (charts, codebook, exports).
- Where new features go (decision tree).
- Generated files (do not hand-edit).

Commit: "docs(architecture): contributor + agent map".
```

## Verification (whole phase)

```sh
bun run typecheck && bun run lint && bun run test && bun run build
# Bundle size diff:
bun add -d size-limit @size-limit/preset-app
size-limit
# Manual: Computer Use replays the screenshot tree; nothing changed.
```

## Done criteria

- [ ] 3.1 Pre-refactor screenshots committed.
- [ ] 3.2 admin.tsx ≤ 200 lines; child routes under src/routes/admin/*.
- [ ] 3.3 SurveyRunner.tsx ≤ 400 lines; hooks extracted with unit tests.
- [ ] 3.4 No `as any` in src/lib/.
- [ ] 3.5 `isAnswered` has one home.
- [ ] 3.6 Admin pure functions under src/lib/admin/.
- [ ] 3.7 `LocalizedString` strictness enforced.
- [ ] 3.8 ARCHITECTURE.md exists and is linked from README.
- [ ] Bundle diff recorded; no regression on /.

## Breaking-change flags

- 3.2 may change deep-link URLs (e.g. /admin?tab=exports → /admin/exports).
  **Confirm with the human**. If old URLs need to keep working, add
  redirects.
- 3.7 may surface dozens of compile errors at first run. Allocate buffer
  time. If the surface is too large, defer the strictness and log via
  the existing `pickText` dev warning instead.
