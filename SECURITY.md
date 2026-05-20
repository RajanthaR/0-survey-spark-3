# Security Policy

## Reporting A Vulnerability

Report vulnerabilities privately to Rajantha R Ambegala at
rajantha.rc@gmail.com. Include the affected route or workflow, reproduction
steps, impact, and any logs or request IDs that do not expose respondent PII.

Do not open a public GitHub issue for security-sensitive findings.

## Supported Versions

The supported version is the current `main` branch and any active production
deployment derived from it.

## Response SLA

- Acknowledgement: within 3 business days.
- Initial triage: within 7 business days.
- Critical fix target: as soon as safely possible, with rollback considered
  before a full patch if production data or access is at risk.
- Non-critical fix target: scheduled into the next maintenance release.

## Threat Model Summary

The app protects anonymous respondent submissions, optional contact data,
admin-only exports, and service-role database access. Respondent writes go
through server functions with rate limiting, Turnstile, payload size caps, and
resume-token checks. Admin access requires Supabase Auth plus an `admin` role.
Cloudflare Worker logs and export request IDs are operational data and must not
contain answer payloads, contact fields, or service-role secrets.
