# Production readiness follow-ups — 2026-06-11

Codex task prompt for the remaining findings (F-03–F-10) from
[audits/production-readiness_fable.md](../audits/production-readiness_fable.md).
Run **after** [predeploy-dependency-fixes-2026-06-11.md](./predeploy-dependency-fixes-2026-06-11.md)
(F-01/F-02) is complete.

---

**Task: Implement the remaining production-readiness findings in survey-spark-3 (F-03 through F-10)**

Repo: `survey-spark-3` (TanStack Start app on Node 24, Bun 1.3.14, deployed to
Railway via nixpacks; SSR served by `server-node.mjs` using `srvx`). Context:
`audits/production-readiness_fable.md` documents these findings; F-01/F-02
(xlsx + TanStack advisories) were fixed in a previous task. Work through the
items below in order, **one commit per item**, running
`bun run typecheck && bun run lint` before each commit and the full
`bun run test` after items 2, 3, and 5.

**1. F-03 — Clear the dev-only `brace-expansion` advisory**

Run `bun update` for the dev toolchain (eslint, lighthouse, typescript-eslint
transitive deps) so `bun audit` reports zero known advisories. Stay within
existing semver ranges; do not bump major versions of any direct devDependency.

**2. F-05 — Add a `/healthz` endpoint**

`server-node.mjs` currently serves static assets + delegates everything to the
SSR handler. Add a lightweight health check that responds before SSR is
invoked: in `server-node.mjs`, short-circuit requests to `/healthz` with a
`200` JSON body (`{"status":"ok"}`) and `Cache-Control: no-store`. It must not
touch Supabase, Redis, or the router. Add a check to `scripts/smoke-ssr.mjs`
(or the smoke flow it drives) asserting `/healthz` returns 200, so the
deploy-gate workflow covers it. Mention the endpoint in `docs/DEPLOYMENT.md`
as the recommended Railway healthcheck path.

**3. F-06 — Enforce `REDIS_URL` presence in production boot guard**

In `src/lib/security-headers.server.ts`, `assertProductionSecurityConfig`
validates Turnstile config but not the rate limiter. Extend it: when running
in production (use the existing `isProductionEnv` helper) and `REDIS_URL` is
unset, **throw** at boot — unless an explicit opt-out flag
`ALLOW_IN_MEMORY_RATE_LIMIT=true` is set, in which case log a loud
`console.warn` instead. Follow the exact precedent of the `TURNSTILE_DISABLED`
kill-switch directly above (deliberate, reversible, warn-loud). Update
`.env.example` and `docs/DEPLOYMENT.md` to document the new flag. Extend the
existing tests for `assertProductionSecurityConfig` (find them near the other
`security-headers` tests in `src/lib/__tests__/`) to cover: prod + no
REDIS_URL → throws; prod + flag → warns, no throw; non-prod → no-op.

**4. F-04 — Fix the flaky `StudyLaneContent` test**

`src/about/components/__tests__/StudyLaneContent.test.tsx` — the test
`"switches study page copy through the shared LanguageToggle"` times out at
the default 5s under CPU contention (jsdom + userEvent round trip). It passes
in isolation. Raise its timeout to 30s by passing a timeout as the test's last
argument, and prefer `findBy*` queries with generous timeouts over `getBy*`
after the toggle interaction. Do not change the component.

**5. F-07 — Client error reporting endpoint**

Add a minimal error-report sink so client-side crashes are visible in Railway
logs:

- New API route under `src/routes/api/` (follow the existing route-file
  conventions there — see `src/routes/api/about/research-aggregates.ts` and
  `src/routes/api/admin/export[.]csv.ts` for how handlers register) accepting
  `POST /api/error-report` with a JSON body validated by zod:
  `{ message: string (max 2000), stack?: string (max 8000), url?: string (max 500), lang?: "en"|"si"|"ta" }`.
  Reject anything else with 400.
- Rate limit it with the existing per-IP token bucket
  (`src/lib/rate-limit.server.ts`, follow how other endpoints consume it) —
  e.g. capacity 5 per minute — so it can't be used to flood logs.
- On success, `console.error("[client-error] …")` with the validated fields
  and respond 204. **Never** echo the input back, never store it in the DB.
- Wire the client: the root error boundary in `src/routes/__root.tsx` (and/or
  the error page helper `src/lib/error-page.ts`) should fire-and-forget a
  `fetch` to this endpoint when it catches, swallowing all failures. Respect
  SSR (no `window` access on the server path).
- Add a vitest covering the zod validation and the 204/400 paths.

**6. F-08 — CSP/header tidy in `src/lib/security-headers.server.ts`**

Three small changes to `applySecurityHeaders` / `buildContentSecurityPolicy`:

- Drop the duplicate `Content-Security-Policy-Report-Only` header (it
  duplicates the enforced policy and has no report endpoint).
- Make framing consistent: change `frame-ancestors 'self'` to
  `frame-ancestors 'none'` to match `X-Frame-Options: DENY` — but first grep
  the codebase for anything that legitimately embeds the app in a same-origin
  iframe (check e2e specs and the about/present pages); if something does,
  keep `'self'` and change `X-Frame-Options` to `SAMEORIGIN` instead.
- Narrow `connect-src` from `'self' https: wss:` to `'self'` plus the Supabase
  host (derive from `VITE_SUPABASE_URL`/`SUPABASE_URL` at request time — note
  the function currently takes only a nonce, so extend its signature carefully
  and update all callers) plus `https://challenges.cloudflare.com`. Include
  the `wss:` variant of the Supabase host for realtime. If the env var isn't
  available where the CSP is built, keep `https:` and leave a comment
  explaining why — do not break Supabase auth/API calls. Update the existing
  header tests.

**7. F-10 — E2E test for the core survey submission flow**

Add `e2e/survey-submit.spec.ts` (Playwright, follow the structure of
`e2e/survey-language-toggle.spec.ts` for base-URL handling and fixtures).
Cover the happy path end to end: load a survey via `/s/<slug>` (find a valid
slug from `src/surveys/`), answer enough questions to reach completion (drive
the runner via accessible roles/labels, not CSS classes), submit, and assert
the completion screen renders and a resume token is cleared/finalized. Use
whatever Turnstile bypass mechanism the existing dev/test environment provides
(`ALLOW_TURNSTILE_BYPASS` / `TURNSTILE_DISABLED` — check how `e2e` and
`scripts/smoke-ssr.mjs` boot the server) — do not weaken production behavior.
If the flow requires a live Supabase and none is configured in the
environment, mark the spec `test.skip` on missing env (same pattern other
scripts use for missing `STAGING_*` vars) and say so in the final report.

**Acceptance criteria**

- `bun audit` → no advisories.
- `bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run test`,
  `bun run build`, `bun run smoke` all pass.
- `curl localhost:<port>/healthz` returns 200 against the built server.
- 7 commits, one per item, conventional-commit style messages referencing the
  finding IDs (F-03…F-10).
- Finish with a short report listing anything skipped or deferred and why
  (e.g. e2e skipped for missing env).
