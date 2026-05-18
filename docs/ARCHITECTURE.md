# Architecture

Survey Spark 3 is a TanStack Start app with a client-rendered survey runner and
server-only Supabase functions for persistence, admin analytics, and exports.

## Route Map

- `/` lists the public survey entry points.
- `/s/$slug` runs a survey and resumes local or URL-provided tokens.
- `/r/$token` resolves a resume token and forwards to the matching survey.
- `/admin` is the authenticated admin layout and redirects to `/admin/stats`.
- `/admin/stats`, `/admin/responses`, `/admin/exports`, `/admin/reports`, and
  `/admin/alerts` are the admin feature routes.
- `/api/admin/export.csv` streams the all-valid CSV export.

Route-private admin helpers live under `src/routes/admin/-shared/`; files with
the leading hyphen are intentionally excluded from TanStack route generation.

## Server Function Boundaries

Client-imported route and component modules must not statically import
server-only implementations. Public server function wrappers live in
`src/lib/*.functions.ts` and dynamically import `*.impl.server.ts` or
`*.shared.server.ts` from inside `createServerFn().handler(...)`.

Admin auth, stats, and exports are exposed through `src/lib/admin.*.functions.ts`.
Response start/save/complete/resume calls are exposed through
`src/lib/responses.functions.ts`, with the start implementation isolated in
`src/lib/responses.impl.server.ts`.

## Supabase Access

Browser code uses the publishable Supabase client from
`src/integrations/supabase/client.ts`. Privileged queries use the service-role
admin client from `client.server.ts` and must stay behind server functions or API
routes. Client graph files should import only wrappers, types, schemas, and
browser-safe helpers.

## Survey Contract

Survey definitions live in `src/surveys/` and use the types in
`src/surveys/types.ts`. User-facing copy uses `LocalizedString`, which requires
English, Sinhala, and Tamil strings. Use `pickText(localized, lang)` when
rendering text and keep answer validation logic in `src/lib/survey-logic.ts` or
`src/components/survey/validation.ts`.

## Lazy Chunks

Charts are loaded through `src/routes/admin/charts-lazy.ts` so Recharts stays out
of public survey chunks. Export-heavy code paths should remain behind admin
routes or server functions. Generated files such as `src/routeTree.gen.ts` and
Supabase types are not hand-edited.

## Adding Features

Add public survey UI under `src/components/survey/` and shared survey behavior
under `src/lib/survey-logic.ts`. Add admin feature UI to the matching
`/admin/*` route or an admin component, and put pure reusable admin helpers under
`src/lib/admin/`. Add new privileged data access as a server function wrapper
plus server-only implementation.
