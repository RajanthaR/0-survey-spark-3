# Admin Onboarding

This guide walks a new research admin through first access and recovery tasks.

## First Login

1. Set `ADMIN_BOOTSTRAP_EMAIL` on the server-side Worker environment before the
   first admin signs up.
2. Open `/admin`, choose sign up, and use the exact configured bootstrap email.
3. Confirm the email in the Supabase Auth message before attempting to sign in.
4. Sign in again at `/admin`. The first matching bootstrap account receives the
   `admin` role.

Only the configured bootstrap email can become the first admin automatically.
After the first admin exists, additional admins must be granted manually in
`public.user_roles`.

## Add A Second Admin

Find the user UUID in Supabase Auth, then insert the role row:

```sql
insert into public.user_roles (user_id, role)
values ('00000000-0000-0000-0000-000000000000', 'admin')
on conflict (user_id, role) do nothing;
```

Ask the new admin to confirm their email before signing in.

## Remove An Admin

```sql
delete from public.user_roles
where user_id = '00000000-0000-0000-0000-000000000000'
  and role = 'admin';
```

Keep at least one known-good admin account active before removing another admin.

## Reset A Password

- Use the `/reset-password` route or Supabase Auth dashboard password reset.
- Confirm the account email remains verified after reset.
- If repeated sign-in attempts were made, wait for any Supabase or app-level
  lockout window to clear before retrying.

## Viewer-only Access

Viewer-only onboarding is deferred. The portable `db/schema.sql` mentions a
`viewer` role, but the live Supabase migration currently creates only the
`admin` enum value. Do not insert `viewer` rows until a migration adds the live
role and the UI enforces read-only behavior.

## Exports And Retention

- Exports download through the admin browser session; they are not stored by the
  app as durable files.
- Record request IDs, checksums, row counts, filenames, and operator names in
  the research export log.
- Store downloaded exports only in the approved research storage location.
- Follow the retention and restore procedures in `BACKUP_RESTORE.md`.

## If Alerts Fire

- Turnstile or bot alerts: see the incident response section in
  `RESEARCHER_OPS.md`.
- Export failures: preserve the request ID and retry/resume from the admin UI.
- Error-rate alerts: correlate request IDs with Cloudflare Worker logs and
  recent deploys.
- Data concerns: pause sharing exports and follow `SECURITY.md`.
