# Backup And Restore Runbook

This project stores research responses in Supabase Postgres. Treat backups as
part of fieldwork operations, not only infrastructure.

## Supabase PITR

- Confirm Point-in-Time Recovery is enabled for the production Supabase project
  before launch.
- Record the configured retention window in the project operations log.
- Review the retention window before major outreach campaigns; fieldwork volume
  can change recovery expectations.

## Manual Export Pipeline

- Keep the canonical weekly export from `/admin` with its codebook, request ID,
  row count, and checksum.
- For database-level backups, run a SQL dump from a trusted environment that has
  the database connection string, then store the encrypted artifact in approved
  research storage.
- Keep raw exports with contact fields restricted to operators who need them.
- Do not restore production contact data into staging unless it has been
  explicitly approved and redacted.

Example operator command:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file "eip-$(date +%F).dump"
```

## Restore Drill

Run a restore drill quarterly and after any migration that materially changes
`responses`, `user_roles`, RLS, or export behavior.

1. Create an isolated staging/restored database or schema.
2. Restore the latest approved dump.
3. Apply pending migrations if the dump predates the current release.
4. Start the app against the restored target.
5. Verify `/admin` can read responses and exports produce expected row counts.
6. Verify a redacted/anonymized dataset can be produced for analysis.
7. Record restore duration, operator, source backup, target, and issues found.

## Redacting PII For Staging

- Remove or replace `responses.contact` before staging restores unless the
  staging environment is approved for contact data.
- Preserve row counts, survey slugs, language, status, progress, and answer
  shape so analytics and export testing remain meaningful.
- Keep the redaction SQL with the restore record so the dataset lineage is clear.

Example redaction:

```sql
update public.responses
set contact = null,
    user_agent = null;
```

## Quarterly Checklist

| Item                                   | Result |
| -------------------------------------- | ------ |
| PITR retention verified                |        |
| Latest manual export checksum verified |        |
| Restore target created                 |        |
| Dump restored successfully             |        |
| Migrations applied                     |        |
| Admin read/export verified             |        |
| PII redaction verified                 |        |
| Duration and issues logged             |        |
