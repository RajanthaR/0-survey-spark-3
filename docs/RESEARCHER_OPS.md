# Researcher Operations Runbook

This runbook covers the operating rhythm for launching, monitoring, exporting,
and closing an EIP Insight survey.

## Pre-launch QA

- Confirm the target survey route loads for every language: English, Sinhala,
  and Tamil.
- Complete one sample response for each survey phase and each question type:
  text, long text, email, telephone, numeric, single choice, multi choice,
  Likert, consent, and optional contact.
- Resume a saved response from its resume link and confirm answers, language,
  and progress return correctly.
- Submit at least one completed response, then verify it appears in the admin
  dashboard with the expected survey slug, language, status, request ID, and
  timestamps.
- Run a sample export and record its request ID, row count, checksum trailer,
  and filename in the launch log.
- Check the alerts panel and drop-off chart before publishing the invitation
  link so the team knows what "normal" looks like.

## Daily Monitoring

- Open `/admin` and review live response counts, completion rates, language
  distribution, drop-off, and alerts.
- Triage alerts in this order: Turnstile failures, export failures, response
  error spikes, and unusual drop-off.
- For a Turnstile spike, pause broad outreach if possible, check Cloudflare
  challenge status, and confirm `ALLOW_TURNSTILE_BYPASS` is not enabled in
  production.
- For an error-rate spike, copy the affected request IDs from the admin UI and
  correlate them with Cloudflare Worker logs.
- For a drop-off spike, inspect the question and language where respondents
  leave, then decide whether the research team needs clarification copy or
  respondent support.

## Weekly Export

- Export the canonical all-valid dataset first. Use filtered exports only for
  review or ad-hoc analysis.
- Save the request ID, export type, row count, checksum, filename, operator,
  and export time in the research export log.
- Download the codebook alongside each weekly data export so analysis scripts
  are pinned to the exact question and option shape in use.
- Validate the checksum trailer before sharing an export outside the admin
  environment.
- Store working exports in the approved research storage location. Do not email
  raw exports with contact fields.

## Survey Closeout

- Announce the closeout window to the research team before disabling outreach.
- Run final exports: all-valid CSV, localized XLSX, validation report, codebook,
  and ZIP bundle if required.
- Record final request IDs, checksums, row counts, and filenames in the
  closeout log.
- Review optional contact fields and decide whether the analysis dataset should
  be anonymized before wider sharing.
- Preserve the final codebook and manifest with the dataset.
- Follow the applicable university, IRB, ethics-board, or funder reporting
  requirements before archiving or deleting data.

## Incident Response

- Turnstile spike: confirm Cloudflare service health, challenge key validity,
  and production env values; contact respondents only after the challenge path
  is healthy again.
- Export failure: retry once, preserve the failed request ID, then use the
  resume/recovery UI if the streaming export already emitted partial data.
- Error spike: collect affected routes, request IDs, timestamps, and recent
  deploy SHA; rollback if the spike follows a deploy.
- Abuse: pause public distribution links, review Worker logs for IP clusters,
  and tighten Turnstile/rate-limit settings before reopening.
- Data incident: stop exports, preserve logs, notify the project owner, and
  follow the disclosure process in `SECURITY.md`.
