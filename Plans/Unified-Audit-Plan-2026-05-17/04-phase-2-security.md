# Phase 2 — Security & Privacy Hardening

## Goal

Production deploys cannot ship without Turnstile + admin lockout +
deploy preflight + headers. Resume tokens stop leaking through URLs.

## Why now

P0 + P1 leave the suite green and the `adminLoginGuard` already fixed.
Security touches small files (auth guard, headers, Turnstile policy)
that are best landed before P3 refactors scatter the touch-points.

## Sources

- `audits/07-security.md` (S-1 to S-13)
- `audits/02-uiux.md` (U-3 — token in URL)
- `audits/13-codex-parity-supplement.md` (S-15 already in P1, S-16 CSP)
- `Codex-audits/08-security-privacy-audit.md`

## Codex Sessions

### Session 2.1 — Production Turnstile policy (S, ~1h)

```text
Goal: Production must fail closed. Dev/preview may fail open.

Read:
- src/lib/turnstile.server.ts (whole file)
- src/start.ts
- docs/DEPLOYMENT.md

Edit:
1. Add a startup assert in src/start.ts:
   if (process.env.NODE_ENV === "production" && !process.env.TURNSTILE_SECRET) {
     throw new Error("TURNSTILE_SECRET required in production");
   }
2. Same for ALLOW_TURNSTILE_BYPASS — if "true" in production, throw.
3. In turnstile.server.ts, keep the dev fail-open path with a clearer
   warning: "[turnstile] dev fail-open: install TURNSTILE_SECRET to
   exercise the real flow".
4. Update docs/DEPLOYMENT.md with the new contract.
5. Add a unit test that the start-up assert fires in NODE_ENV=production
   without the secret.

Verification:
- bun run test src/lib/__tests__/turnstile.* passes.
- bun run dev with no secret prints the warning.
- A production-mode build refuses to boot without the secret.

Commit: "security(turnstile): fail closed in production".
```

### Session 2.2 — Resume token out of the URL bar (M, ~3h)

```text
Goal: Resume token never appears in the URL after first load. It is
persisted to localStorage and the URL is rewritten via history.replace.

Read:
- src/components/SurveyRunner.tsx (focus on the navigate({ search: { token }})
  pattern around lines 162-243)
- src/components/survey/ResumeStrip.tsx
- src/lib/responses.functions.ts (resumeResponse)
- src/routes/r.$token.tsx (if it exists)
- audits/02-uiux.md U-3

Edits:
1. On first arrival via /r/$token, immediately call history.replaceState
   to remove the token from window.location.
2. Persist the token under a per-survey-slug localStorage key with
   short TTL (e.g. 24h sliding window).
3. ResumeStrip reads from localStorage; the URL never contains the token
   except on the initial /r/$token landing.
4. Add a test that asserts the URL bar is clean after first render.

Tradeoffs to flag for the human:
- If the user shares the URL after starting, that share will not include
  the resume token any more. The new behaviour is "use the explicit
  resume strip 'Get my link' button to share". Confirm this is desired.

Verification:
- Computer Use: open /s/phase-1, answer 2 questions, screenshot URL,
  assert no ?token= or #token= remains.
- bun run test src/components/__tests__/SurveyRunner.* still pass.
- E2E: a copy of the resume link still resumes correctly.

Commit: "security(resume): keep token out of the URL bar".
```

### Session 2.3 — HSTS + Permissions-Policy + Referrer-Policy (S, ~1h)

```text
Goal: Add the three missing security headers.

Read:
- src/start.ts
- src/routes/__root.tsx (existing CSP meta)

Edit:
1. Add a request middleware in src/start.ts that sets:
   Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
   Permissions-Policy: camera=(), microphone=(), geolocation=(),
       payment=(), usb=(), magnetometer=(), gyroscope=()
   Referrer-Policy: strict-origin-when-cross-origin
   X-Content-Type-Options: nosniff
   X-Frame-Options: DENY
2. Leave the existing CSP meta in place (will harden in 2.5).
3. Add a smoke test that GETs / and asserts each header.

Verification:
- bun run smoke checks the new headers.
- securityheaders.com style probe (run from Computer Use): A or A+ rating.

Commit: "security(headers): add HSTS + Permissions-Policy + Referrer-Policy".
```

### Session 2.4 — Durable Object rate limiter (M, ~3h)

```text
Goal: Move the in-memory rate-limit Map to a Cloudflare Durable Object so
isolate restarts cannot reset attacker counters.

Read:
- src/lib/rate-limit.server.ts (whole file)
- wrangler.jsonc

Edits:
1. Add a new file src/lib/rate-limit.do.ts implementing
   `RateLimitDO extends DurableObject` with the token-bucket algorithm.
2. Update wrangler.jsonc to declare the DO binding.
3. Refactor src/lib/rate-limit.server.ts so:
   - In production, it forwards to the DO via the binding.
   - In dev/test (no binding), it falls back to the existing Map for
     local dev ergonomics.
   - The peek() helper added in Session 1.2 forwards too.
4. Update audits/07-security.md S-3 status to "shipped".

Verification:
- bun run test rate-limit-related specs pass against the in-memory path.
- After deploy to a staging Worker, a hammered IP stays locked across
  isolate restarts (manual smoke).

Tradeoff:
- DO adds a small latency (~1ms) on every guarded server-fn call. Document
  the budget in docs/PERFORMANCE.md once it exists.

Commit: "security(rate-limit): durable bucket via Cloudflare Durable Object".
```

### Session 2.5 — CSP nonce + drop `'unsafe-inline'` (M, ~3h, partly DEFER)

```text
Goal: Replace `'unsafe-inline'` on script-src with per-request nonces.

Read:
- src/routes/__root.tsx:80-120 (current CSP)
- audits/13-codex-parity-supplement.md S-16

Edits (do these now):
1. Replace the inline pre-hydration <script> with a server-rendered
   <html lang> driven by a cookie/hint header (the `Lang` cookie). This
   removes the need for the inline script — meeting also audits/02-uiux U-2
   and audits/08-i18n I-4.
2. Update the CSP to:
   - script-src 'self' https://challenges.cloudflare.com (no unsafe-inline)
   - script-src-elem 'self' 'nonce-XXX' https://challenges.cloudflare.com
   - keep style-src 'self' 'unsafe-inline' for now (Tailwind v4 inline)
3. Wire a per-request nonce through TanStack Start's <Scripts /> by
   setting a `nonce` prop or via the `start.ts` HTML response.

Defer (note in 09-deferred-breaking.md):
- Removing `'unsafe-inline'` from style-src requires enumerating Tailwind
  inline styles or shipping a build-time nonce. Tailwind v4 doesn't yet
  support build-time nonces cleanly; defer until v4.x supports it.

Verification:
- Visit / and view-source: <html lang="..."> matches the cookie.
- CSP report-only header for one week before tightening (`Content-Security-Policy-Report-Only`).
- bun run smoke verifies the nonce attribute.

Commit: "security(csp): server-render <html lang> + drop script unsafe-inline".
```

### Session 2.6 — Service-role key audit logger (S, ~1h)

```text
Goal: Every supabaseAdmin import logs a one-time reason at boot so any
new service-role caller is visible in audit logs.

Read:
- src/integrations/supabase/client.server.ts
- audits/11-database-deployment.md DB-7

Edits:
1. Replace `export const supabaseAdmin = createClient(...)` with
   `export function createAdminClient(reason: string)` that returns the
   service-role client and logs `{ reason, file, ts }` once per reason.
2. Update every existing call site to pass a reason
   (e.g. "responses.startResponse").
3. Add a CI grep that fails the build if a *.tsx (client) file imports
   the admin client.

Verification:
- bun run typecheck exits 0.
- bun run lint exits 0.
- The audit log shows one line per reason at startup.

Commit: "security(supabase): audit-logged service-role client factory".
```

### Session 2.7 — Stale-row cron (S, ~1h)

```text
Goal: Expire in_progress responses older than 30 days.

Read:
- supabase/migrations/<latest>
- audits/07-security.md S-13

Edits:
1. New migration:
   create extension if not exists pg_cron;
   create or replace function expire_stale_responses()
     returns void
     language sql
     security definer
     set search_path = public
   as $$
     update public.responses
     set status = 'expired', updated_at = now()
     where status = 'in_progress'
       and started_at < now() - interval '30 days'
       and status <> 'expired';
   $$;
   select cron.schedule('expire-stale-responses', '0 3 * * *',
                        $$select expire_stale_responses();$$);
2. Bump the responses status enum or text constraint to allow 'expired'.
3. Test the migration on a local Supabase before committing.

Verification:
- supabase db push succeeds locally.
- A seeded row with started_at=now()-31d flips to 'expired' after the
  function runs.

Commit: "security(retention): expire in_progress responses after 30d".
```

## Verification (whole phase)

```sh
bun run typecheck && bun run lint && bun run test && bun run build
bun run smoke           # checks CSP, HSTS, etc.
# Manual: securityheaders.com against staging URL → A+
```

## Done criteria

- [ ] 2.1 Prod Turnstile fail-closed; dev fail-open kept.
- [ ] 2.2 Resume token never in URL bar after first hop.
- [ ] 2.3 HSTS + Permissions-Policy + Referrer-Policy headers present.
- [ ] 2.4 Rate limiter forwards to a Durable Object in prod.
- [ ] 2.5 CSP `script-src` no longer needs `'unsafe-inline'`.
- [ ] 2.6 supabaseAdmin replaced by audit-logged factory.
- [ ] 2.7 Stale-row cron landed.
- [ ] securityheaders.com → A+ on staging.

## Breaking-change flags

- 2.2 changes share-link semantics (URL no longer carries the token).
  **Confirm with the human before shipping**; deferral path: ship behind
  a feature flag.
- 2.5 partial — `style-src` still needs `'unsafe-inline'`. Marked deferred
  in `09-deferred-breaking.md`.
- 2.4 introduces a new infra dependency (Durable Object). Cost +
  cold-start budget needs the human's deploy approval.
