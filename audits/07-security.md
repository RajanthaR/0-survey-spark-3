# Audit 07 — Security

Scope: auth, RLS, secrets, headers, bot defence, input validation, abuse.

## Strengths

- **Turnstile is wired into `startResponse`.** `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/responses.functions.ts:50-58` rate-limits, verifies the token, then inserts.
- **Per-IP token-bucket rate limit** on every public server fn (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/rate-limit.server.ts:40-62`).
- **Resume token rotates on completion.** `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/responses.functions.ts:144-160`.
- **RLS is enabled** on both `user_roles` and `responses` (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/supabase/migrations/20260514192711_*.sql:23-58`).
- **Admin bootstrap is env-gated.** `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/admin.auth.functions.ts:20-30` requires `ADMIN_BOOTSTRAP_EMAIL` to match and that no admin already exists.
- **Server fns guarded by `requireSupabaseAuth` middleware** + `assertAdmin` for sensitive reads (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/admin.shared.server.ts:26-35`).
- **Payload size cap** at 64 KB on `saveAnswers`/`completeResponse` (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/responses.functions.ts:7-10`).

## Findings

### S-1 — Turnstile fail-open when `TURNSTILE_SECRET` is unset _(high)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/turnstile.server.ts:61-68` silently allows traffic in production if the secret is missing. The comment explains the rationale (avoid a misconfig lockout), but for production this is a foot-gun. Add an explicit `process.env.NODE_ENV === "production" && !secret` guard that throws on startup, or a dedicated `REQUIRE_TURNSTILE=true` flag for prod.

### S-2 — No admin login lockout _(high)_

Item #4 in `Plans/AuditV2-fixes.md` is still open. Add a per-email + per-IP failure counter (re-use the rate-limit buckets) on the Supabase auth `signInWithPassword` path. Without it, brute-forcing the admin is throttled only by Supabase rate limits.

### S-3 — In-memory rate limit isn't durable _(medium)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/rate-limit.server.ts:8` keeps a single `Map`. Cloudflare Worker isolates start cold; attacker can rotate isolates by traffic. Move to a Durable Object keyed by IP.

### S-4 — Server-only env reachable on client?

Verify that `SUPABASE_SERVICE_ROLE_KEY` is **only** referenced from `*.server.ts` / `*.functions.ts` and never imported from a client module. Use `grep -rn "SUPABASE_SERVICE_ROLE_KEY" src/`. (The deploy doc already separates server vs client secrets — confirm at build time too.)

### S-5 — `bypassTurnstile` requires runtime + env to be aligned

Both client and server check separate conditions. The server gate (`ALLOW_TURNSTILE_BYPASS=true`) is the only one that matters; document this clearly in `docs/DEPLOYMENT.md` (already partially done) and assert `ALLOW_TURNSTILE_BYPASS !== "true"` in production via a deployment health check.

### S-6 — No CSP / HSTS / Permissions-Policy / Referrer-Policy headers _(medium)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/start.ts` does not set security headers. Add via a request middleware:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- `Content-Security-Policy: default-src 'self'; script-src 'self' challenges.cloudflare.com; …`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

### S-7 — Resume URL in address bar _(medium)_

`?token=…` ends up in browser history + access logs. See `audits/02-uiux.md` U-3.

### S-8 — RLS policy only `FOR SELECT` _(check)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/supabase/migrations/20260514192711_*.sql:56-58` allows admins to read but does not restrict writes. The `supabaseAdmin` service-role client bypasses RLS so this is OK for the current flow, but if any feature ever uses an anon-keyed client to write, it would silently succeed. Add explicit `FOR INSERT/UPDATE/DELETE TO authenticated USING (false)` defaults.

### S-9 — No request-size limit at the edge _(low)_

Beyond the in-handler 64 KB JSON cap, there's nothing stopping a 1 GB POST from being read into the Worker before parsing. Add a `Content-Length` short-circuit at the request middleware level (or rely on Cloudflare's request body limits — document the chosen limit).

### S-10 — `console.warn` leak through to production logs

`turnstile.server.ts:55-66` warns on bypass. Production logs may surface in observability tooling; ensure no PII is included. (Currently fine, but worth a policy.)

### S-11 — XSS via `Question.help` is mitigated by React's auto-escape

Good — `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/survey/QuestionView.tsx:170-172` renders `pickText(q.help, lang)` as text content. The audit plan already flagged sanitisation if survey JSON ever loads dynamically.

### S-12 — Supabase Auth email confirmation status not asserted in CI

The deployment doc says to verify "Confirm email" is ON in Supabase Auth. Add a `bun run smoke` check that probes `/auth/v1/settings` to confirm.

### S-13 — Anonymous `responses` rows can grow forever

No TTL on incomplete responses. Add a cron (Supabase scheduled function) to soft-delete `in_progress` rows older than 30 days.

### S-14 — Resume token is 16-byte random hex — fine

Verify with a grep that the generator uses `crypto.randomBytes(16)` or `crypto.getRandomValues` (not `Math.random`).

## Suggested improvements

1. Add `REQUIRE_TURNSTILE=true` for prod; throw at startup if secret is missing.
2. Implement admin login lockout (per-email + per-IP).
3. Move rate-limit to a Durable Object or KV.
4. Add a CI grep to fail builds that import service-role env from a client file.
5. Add CSP / HSTS / Permissions-Policy headers via request middleware.
6. Move resume token out of URL bar.
7. Add explicit RLS deny-by-default for INSERT/UPDATE/DELETE.
8. Add a cron to purge stale `in_progress` rows after 30 days.
9. Document the Cloudflare body-size limit in `docs/DEPLOYMENT.md`.
10. Add a deploy gate that asserts `ALLOW_TURNSTILE_BYPASS !== "true"` in production.
