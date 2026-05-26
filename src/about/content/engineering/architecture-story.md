# Engineering Architecture

This page is a reviewer-grade map of the current EIP Insight runtime. It stays short on purpose: each section explains the main boundary and links to the runbooks or audit notes that carry operational detail.

## System At A Glance

{{architecture-overview}}

The production path is a Railway Node service. Bun installs dependencies and Vite emits `dist/client` plus `dist/server/server.js`; `server-node.mjs` serves static client assets first and delegates the rest to the Web-Fetch server bundle.

Runtime configuration comes from process environment variables. Supabase backs auth and response persistence, and Redis backs the cross-replica rate limiter when `REDIS_URL` is set. The current deployment checklist lives in [docs/DEPLOYMENT.md](/docs/DEPLOYMENT.md), with migration history in [docs/RAILWAY-MIGRATION.md](/docs/RAILWAY-MIGRATION.md).

## Request Lifecycle

{{request-lifecycle}}

Every request reaches `server-node.mjs` first. `srvx/static` handles hashed assets from `dist/client`; SSR and server-function requests fall through to `src/server.ts`, which imports TanStack Start's server entry lazily and normalizes catastrophic SSR failures into the branded error page.

Security headers are applied in `src/start.ts` through `src/lib/security-headers.server.ts`. Server functions then handle domain checks such as auth, rate limiting, Turnstile verification, Supabase writes, and admin reads.

## Survey Response Write Path

{{survey-write-path}}

The respondent write path begins in `SurveyRunnerImpl`. The first protected write calls `startResponse`, which validates the RPC input, consumes a rate-limit token, verifies Turnstile when configured, and inserts a new `responses` row through the Supabase service-role client.

The returned `resume_token` is the capability used for later autosaves and completion. `saveAnswers` and `completeResponse` do not re-run Turnstile; they rate-limit and validate the resume token instead. Related operational details are in [docs/RESEARCHER_OPS.md](/docs/RESEARCHER_OPS.md) and [docs/TROUBLESHOOTING.md](/docs/TROUBLESHOOTING.md).

## Auth And Admin Path

{{admin-auth-path}}

Admin sign-in is client-visible, but privileged reads and exports are server functions. `requireSupabaseAuth` validates the bearer token, `adminBootstrap` can seed the first admin when the configured email matches, and shared helpers check `user_roles` before touching response analytics or export paths.

The admin route is intentionally not indexed and all export functions go through service-role server modules. See [docs/ADMIN_ONBOARDING.md](/docs/ADMIN_ONBOARDING.md) and [docs/BACKUP_RESTORE.md](/docs/BACKUP_RESTORE.md) for researcher-facing operations.

## i18n Pipeline

{{i18n-pipeline}}

The UI dictionary in `src/lib/i18n.tsx` and survey definitions in `src/surveys/` are the source of rendered language strings. Components read the active language through `useLang`, then call `pickText` so missing Sinhala or Tamil strings fall back predictably and are counted in tests.

Resume flows preserve the stored response language. That means a resumed survey should render from the `responses.language` value when available, while the language toggle and cookie still control fresh sessions and non-survey shell text.

## Rate Limit And Redis Fallback

{{rate-limit}}

`src/lib/rate-limit.server.ts` implements a token bucket. In production, `REDIS_URL` enables an atomic Lua-backed Redis bucket so replicas share limits. When Redis is unset or transiently unavailable, the code falls back to a per-process `Map`.

That fallback is useful for local development and tests, but it is not a production substitute across multiple replicas. The fallback logs `[rate-limit] Redis call failed; falling back to in-memory:` on failures, which is expected in the dedicated Redis tests.
