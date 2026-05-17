# Product And Admin Workflows Audit

## Current State

The product workflow covers respondent discovery, consent, survey completion, review, optional contact, and resume. The admin workflow covers login/bootstrap, analytics, filters, response detail, reports, exports, codebooks, validation, alerts, live status, and download recovery.

## Findings

- Respondent journey is feature-complete and research-oriented, with save/resume and review steps that support long forms.
- Optional contact happens after review/submission flow, reducing pressure on anonymous respondents, but the exact "recorded" timing should be clear.
- The admin dashboard has broad capabilities, but the number of controls and export modes may be overwhelming without stronger grouping and task hierarchy.
- Export flows are operationally important and include streaming/recovery work, but researcher-facing guidance around partial downloads, request IDs, and valid-only filters should be easy to find.
- Admin login includes sign-up, sign-in, and forgot password, but sign-up copy should reinforce email confirmation and bootstrap email constraints.
- Alerts/live status features exist, but they should be tested with real data and researcher workflows.
- There is no single product operations checklist for pre-launch survey QA, daily monitoring, export handling, and closeout.

## Suggested Improvements

- Add a researcher operations checklist: launch survey, monitor responses, inspect dropoff, export data, validate codebook, archive survey, and handle support issues.
- Group admin dashboard sections around user jobs: monitor, inspect, export, report, configure.
- Add inline or docs-based guidance for export modes: all valid, filtered, localized CSV/XLSX, codebook, ZIP bundle, and validation report.
- Review contact step copy so respondents understand whether answers are already saved and whether contact is optional.
- Add admin onboarding docs for first bootstrap, password reset, email confirmation, and role management.
- Add sample "day in the life" admin workflow tests once Playwright works.
- Add data closeout procedure: final exports, checksum/request ID logging, PII handling, and deletion/retention policy.

## Priority

- P1: Admin workflow grouping and export guidance.
- P1: Researcher operations checklist before production launch.
- P2: Admin onboarding and data closeout docs.
- P2: Workflow e2e tests after tooling is repaired.

## Verification

- Source review covered `admin.tsx`, `LoginPanel`, export progress cards, report panel, alerts, and response detail components.
- No live admin browser walkthrough was possible because local dev server startup is blocked.
- Existing tests indicate several admin/export paths are covered in Vitest, but full workflow e2e coverage is limited.

## Related Files

- `src/routes/admin.tsx`
- `src/routes/admin/LoginPanel.tsx`
- `src/components/admin/AllValidProgressCard.tsx`
- `src/components/admin/ZipBundleProgressCard.tsx`
- `src/components/admin/AnalyticsReportPanel.tsx`
- `src/components/admin/AdminResponseDetail.tsx`
- `src/components/admin/AlertsPanel.tsx`
- `src/lib/admin.exports.functions.ts`
- `src/lib/admin.stats.functions.ts`
