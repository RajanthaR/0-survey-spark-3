# Architecture Audit

## Current State

The app uses file routes for pages and API routes, server functions for respondent/admin data operations, Supabase service-role access on the server, Supabase client auth on the browser, and shared survey definitions in TypeScript. Admin functionality has been partially split into domain server modules and reusable components, but the route remains large.

## Findings

- Route structure is clear: public index, survey slug route, resume token route, admin route, reset password route, and streaming export API route.
- Server-side data boundaries are mostly explicit: respondent writes in `responses.functions.ts`, admin auth/stats/exports in separate modules, shared export logic in `admin.shared.server.ts`.
- `admin.functions.ts` is now a barrel, which preserves compatibility after earlier module splitting.
- `src/routes/admin.tsx` remains about `4099` lines and mixes orchestration, state management, UI layout, export control, filters, persistence, and response table behavior.
- `SurveyRunner.tsx` is smaller than earlier audits but still about `877` lines and contains stage orchestration, autosave, navigation, focus, swipe, validation wiring, and rendering.
- `admin.shared.server.ts`, `admin.stats.functions.ts`, and `admin.exports.functions.ts` are large enough to deserve further internal boundaries.
- The database schema source-of-truth policy is documented, but portable schema and migrations differ by design. That is acceptable only if explicitly maintained.
- Generated files and handwritten files live side by side; guardrails should make generated file behavior clear.

## Suggested Improvements

- Split `src/routes/admin.tsx` into route shell plus focused hooks/panels: auth/bootstrap, filters, stats overview, response list/detail, exports, reports, codebook, alerts.
- Extract `SurveyRunner` hooks for autosave/visibility flush/resume token/stage navigation if behavior can be pinned by tests first.
- Keep server function modules domain-based, but extract reusable query builders and export pipeline helpers where it reduces duplication.
- Introduce a short architecture README for route/data boundaries and where new features should live.
- Keep API route streaming and RPC streaming code sharing through one generator, as currently done for all-valid CSV.
- Add typed contracts around admin filter objects and export request state to reduce route-level state coupling.

## Priority

- P0: Do not refactor until lint/tooling is green enough to verify behavior.
- P1: Split `admin.tsx` behind tests because it is the highest maintenance risk.
- P1: Extract `SurveyRunner` hooks after respondent Playwright coverage exists.
- P2: Add architecture documentation for future contributors/agents.

## Verification

- `wc -l` showed `src/routes/admin.tsx` around `4099` lines, `SurveyRunner.tsx` around `877`, `admin.shared.server.ts` around `865`, `admin.stats.functions.ts` around `706`, and `admin.exports.functions.ts` around `627`.
- `./node_modules/.bin/tsc --noEmit` passes, so current architecture type-checks.
- Build/runtime behavior not verified because Vite is blocked.

## Related Files

- `src/router.tsx`
- `src/routes/admin.tsx`
- `src/components/SurveyRunner.tsx`
- `src/lib/responses.functions.ts`
- `src/lib/admin.auth.functions.ts`
- `src/lib/admin.stats.functions.ts`
- `src/lib/admin.exports.functions.ts`
- `src/lib/admin.shared.server.ts`
- `src/routes/api/admin/export[.]csv.ts`
