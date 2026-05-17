# Audit 05 — Architecture

Scope: module boundaries, file/folder layout, client/server separation, data flow.

## Strengths

- **Server fns sharded by domain.** `admin.auth.functions.ts`, `admin.stats.functions.ts`, `admin.exports.functions.ts` + shared helpers in `admin.shared.server.ts`, with a barrel re-export in `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/admin.functions.ts`.
- **Central middleware.** `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/start.ts:1-25` wires both request-level and function-level scopes.
- **Surveys are pure data.** `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/surveys/types.ts` + validation at module load.
- **i18n is centralised** in `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/i18n.tsx` with a `<LangProvider>`.

## Findings

### A-1 — `SurveyRunner.tsx` (877 lines) owns too much

Mixes stage machine, autosave, resume token, live-region strings, keyboard/swipe, validation, toast dispatch. Extract `useSurveyMachine()`, `useAutoSave()`, `useResumeToken()`.

### A-2 — `admin.tsx` (4 099 lines) with 85 hook calls

Mirror the server-fn split on the client: `routes/admin/exports.tsx`, `routes/admin/stats.tsx`, `routes/admin/responses.tsx`, all under a thin `routes/admin.tsx` layout.

### A-3 — `as any` casts in stats handler

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/admin.stats.functions.ts:391`, `:409`, `:431`, `:474`. Define a typed `applyFilters<T extends PostgrestFilterBuilder<…>>` helper.

### A-4 — Validation logic duplicated

`isAnswered` exists in both `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/survey-logic.ts:41-47` and `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/survey/validation.ts:28-34`. Keep one source.

### A-5 — Client-side admin filter logic is co-located with rendering

`computeDropoff`, `detectAlerts`, etc. live next to the admin components. Move pure functions under `src/lib/admin/` so they are testable without rendering.

### A-6 — Two ways to import server fns

Both `from "@/lib/admin.functions"` and `from "@/lib/admin.exports.functions"` work. Pick one (the barrel is the documented contract) and document import direction in `CONTRIBUTING.md`.

### A-7 — Routes mix layout + page logic

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/__root.tsx` does font preload + lang script + error boundary + `<LangProvider>`. Acceptable, but each is candidate for its own file as it grows.

### A-8 — `routeTree.gen.ts` not git-attribute'd

Add `routeTree.gen.ts merge=union` and `linguist-generated=true` so diff noise is suppressed.

### A-9 — No domain layer

`responses.functions.ts` directly couples Turnstile, rate limit, Supabase insert, and analytics. Consider a `domain/respondent.ts` orchestrator that calls thin adapters — easier to unit-test without a Start context.

### A-10 — `pickText` accepts `unknown`-shaped objects

Sharper generics on `LocalizedString` would let TS catch missing translations at call sites. Right now `pickText({ en: "x" }, "si")` silently falls back.

## Suggested improvements

1. Split `SurveyRunner.tsx` into hooks + a thin orchestrator.
2. Split `admin.tsx` into per-feature child routes.
3. Type the Supabase filter chain (remove `as any`).
4. De-duplicate `isAnswered` into `src/lib/survey-logic.ts`.
5. Move admin pure functions under `src/lib/admin/`.
6. Document import direction in `CONTRIBUTING.md`.
7. Add `.gitattributes` rules for generated files.
8. Tighten `LocalizedString` typing so missing translations are compile errors.
