# Security And Privacy Audit

## Current State

Respondent writes go through server functions using the Supabase service-role client. Admin functions require Supabase auth and an admin role. The app has rate limiting, Turnstile verification, resume-token rotation on completion, payload size caps, completed-response write blocking, CSP metadata, and RLS enabled in migrations.

## Findings

- `startResponse`, `saveAnswers`, `completeResponse`, and `resumeResponse` are unauthenticated by design and guarded by resume tokens, size checks, rate limits, and Turnstile for start.
- `verifyTurnstile` fails open when `TURNSTILE_SECRET` is unset. This is convenient for dev/preview but risky if production secrets are missing.
- Preview bypass behavior is server-gated by `ALLOW_TURNSTILE_BYPASS=true`, and tests exist around bypass safety.
- Resume tokens are stored in localStorage and in URLs. `ResumeStrip` hides raw link until reveal and warns that anyone with it can edit the response.
- Completed responses rotate the resume token, reducing damage from leaked completed links.
- Admin bootstrap is gated by `ADMIN_BOOTSTRAP_EMAIL` and first-admin checks.
- Admin login guard exists, but its `check` and `fail` buckets should be reviewed. The current "check" path rate-limits probing but does not actually inspect the failure bucket, so lockout semantics may not match the comment exactly.
- CSP is delivered via meta tag and includes `unsafe-inline` for scripts/styles. This may be necessary for current framework/runtime behavior, but it is a security tradeoff.
- Admin exports can contain contact PII and full answers. The docs should explicitly define retention, handling, and download/storage expectations.
- LocalStorage is used for language, resume token, admin preferences, export partial buffers, and log link templates. This is functional but should be documented as local-device state.

## Suggested Improvements

- Decide production Turnstile behavior: fail closed when production deploy lacks `TURNSTILE_SECRET`, or add deployment checks that prevent missing secrets.
- Add a startup/deploy smoke check for required production env vars: Supabase URL/key/service role, admin bootstrap email, and Turnstile values.
- Review and correct `adminLoginGuard` so the preflight check enforces prior failures, or rename/document the current behavior accurately.
- Keep resume link reveal private, but refine label and consider expiring/rotating in-progress tokens after long inactivity.
- Add a PII/export handling section to deployment/admin docs: who may export, where files may be stored, retention, deletion, and incident response.
- Review CSP after build is working, and remove `unsafe-inline` where framework-supported nonces/hashes are feasible.
- Consider durable rate limiting for production traffic if in-memory Worker isolate buckets are insufficient.
- Add logging policy for request IDs that avoids logging sensitive answers/contact.

## Priority

- P0: Production secret/Turnstile policy.
- P1: Admin login guard semantics and PII/export handling docs.
- P1: Resume-token lifecycle review.
- P2: CSP hardening and durable rate limiting.

## Verification

- Source review covered `responses.functions.ts`, `turnstile.server.ts`, `rate-limit.server.ts`, `admin-login-guard.functions.ts`, `admin.auth.functions.ts`, and root CSP metadata.
- Tests could not be executed because Vitest is blocked by Rollup native loading.
- RLS policies are present in Supabase migrations and documented in `db/README.md`.

## Related Files

- `src/lib/responses.functions.ts`
- `src/lib/turnstile.server.ts`
- `src/lib/rate-limit.server.ts`
- `src/lib/admin-login-guard.functions.ts`
- `src/lib/admin.auth.functions.ts`
- `src/integrations/supabase/client.server.ts`
- `src/routes/__root.tsx`
- `src/components/survey/ResumeStrip.tsx`
- `supabase/migrations/`
- `db/README.md`
