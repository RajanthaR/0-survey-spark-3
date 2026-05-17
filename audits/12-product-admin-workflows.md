# Audit 12 — Product & Admin Workflows

(Added 2026-05-17 to bring my audit set to parity with the Codex-audits package.)

Scope: end-to-end respondent journey, admin login bootstrap, dashboard task hierarchy, exports, alerts, response detail, daily ops checklist.

## Strengths

- **Respondent journey is complete:** consent → optional consent → questions → review → contact → done, with autosave, resume strip, language toggle, question map, swipe + keyboard, and Turnstile.
- **Admin dashboard surfaces are broad:** stats, filters, response list/detail, exports (CSV / XLSX / ZIP / codebook / validation report), alerts, drop-off charts, sectioned analytics.
- **Bootstrap is hardened:** `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/admin.auth.functions.ts:20-30` requires `ADMIN_BOOTSTRAP_EMAIL` + first-admin only. Includes a `/reset-password` route.
- **Streaming exports + recovery scaffolding** in `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/admin.shared.server.ts` and `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/admin/AllValidProgressCard.tsx`, `ZipBundleProgressCard.tsx`.

## Findings

### W-1 — No researcher operations checklist _(medium)_

A research deployment lifecycle has predictable phases: launch survey → monitor → daily inspect drop-off → run periodic exports → close survey → final export → archive → handle support. None of this is documented. Add `docs/RESEARCHER_OPS.md` with:

- Pre-launch QA checklist (every survey type tested in EN/SI/TA, sample data round-trip).
- Daily monitoring (responses count, drop-off, alerts).
- Weekly exports (with request-ID + checksum logged).
- Closeout (final export, integrity verification, retention).
- Incident response contact tree.

### W-2 — Admin route conflates many jobs in one screen _(medium)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/admin.tsx` (4 099 lines) renders stats + filters + table + exports + alerts + reports together. Researchers must scroll past sections that aren't relevant to their current task. Group around jobs-to-be-done:

- **Monitor** → live status, alerts, dropoff chart.
- **Inspect** → response list, filters, response detail.
- **Export** → all exports + recovery state.
- **Report** → analytics report panel + codebook.
- **Configure** → admin user management, bootstrap, settings.

Tie this to the architecture split (`audits/05-architecture.md` A-2 / `audits/03-performance.md` P-1).

### W-3 — Export modes have unclear differentiation _(medium)_

The dashboard presents: filtered CSV, all-valid streaming CSV (`/api/admin/export.csv`), XLSX, codebook, ZIP bundle, validation report. Without inline guidance, a researcher won't know when to use which. Add:

- Inline help: "Use _all-valid_ for the canonical research dataset. Use _filtered_ to exclude in-progress rows."
- A surfaced request-ID + retry link for every export.
- A docs page mapping use-case → export mode → expected size.

### W-4 — Contact step timing copy is ambiguous _(low)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx` shows the contact form after review. Respondents may worry their answers haven't saved yet. Add explicit microcopy: "Your answers are already recorded. The contact below is optional, used only to share results."

### W-5 — Admin sign-up copy doesn't explain bootstrap constraint _(low)_

The login panel allows sign-up but the first time it runs, only `ADMIN_BOOTSTRAP_EMAIL` will be granted admin. Add inline copy on the sign-up form: "Only the configured bootstrap email becomes the first admin. Email confirmation is required."

### W-6 — Alerts panel lacks a "what to do" runbook _(medium)_

Alerts (drop-off spike, error rate, Turnstile failures) tell the researcher _what_ but not _what next_. Each alert type should link to a runbook section.

### W-7 — Admin onboarding doc missing _(medium)_

There is no `docs/ADMIN_ONBOARDING.md` that walks a new researcher through:

- First login (bootstrap email) + email confirmation.
- Adding a second admin via `user_roles`.
- Resetting a password.
- Inviting a viewer-only role.
- Where exports land + retention policy.

### W-8 — Live-status feature is invisible if the page isn't open _(low)_

If alerts fire while no admin is on the page, no one knows. Add a webhook → email/Slack hook for critical alerts (Turnstile failure spike, error rate > N%). Document in admin onboarding.

### W-9 — Data closeout procedure is undocumented _(medium)_

When the research period ends, what happens to the data? Define:

- Final export bundle (CSV + XLSX + codebook + manifest with SHA256s).
- Anonymisation review (contact field removal).
- Retention period + DELETE schedule.
- IRB / ethics-board reporting if applicable.

### W-10 — No "day in the life" e2e test covering admin workflows _(medium)_

Playwright currently runs one survey-language-toggle spec. Add a workflow spec:

1. Sign in as admin.
2. Apply filters (slug, language, date).
3. Open a response detail.
4. Trigger an export and wait for the request ID.
5. Download and validate the manifest.

### W-11 — Reports panel uses `analytics-report-i18n.ts` which has inline SI/TA literals _(real bug)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/analytics-report-i18n.ts:40` is an analytics i18n file but lives outside the dictionary allowlist. Either move it under `src/lib/i18n/` and update the ESLint allowlist, or refactor to import from `i18n.tsx`. (Also flagged in `audits/01-content.md` C-2.)

## Suggested improvements

1. Add `docs/RESEARCHER_OPS.md` (launch, monitor, export, closeout).
2. Add `docs/ADMIN_ONBOARDING.md` (bootstrap, reset, role management).
3. Group admin dashboard around jobs-to-be-done (Monitor / Inspect / Export / Report / Configure).
4. Add inline help on each export mode + surfaced request IDs.
5. Add explicit "answers already saved" copy on the contact step.
6. Add bootstrap-email explanation on sign-up.
7. Add runbook links to every alert type.
8. Add webhook-based critical alerting.
9. Document data closeout (retention, anonymisation, IRB reporting).
10. Add a Playwright admin workflow e2e covering filter → detail → export → manifest.
11. Move `analytics-report-i18n.ts` into the dictionary allowlist (or under `src/lib/i18n/`).
