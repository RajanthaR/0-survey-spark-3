# Content Audit

## Current State

The app presents a trilingual research survey for EIP Insight with a short public landing page, consent steps, survey questions, resume messaging, review/contact steps, admin login, analytics, and export/report flows. Core copy is spread across `src/lib/i18n.tsx`, `src/surveys/phase-1.ts`, `src/surveys/phase-3.ts`, `src/surveys/consent.ts`, admin components, and route metadata.

## Findings

- Landing copy is concise and purpose-driven, but the public page gives little detail about privacy, expected time per phase, or what respondents need before starting.
- Survey content has EN/SI/TA fields, but survey source comments still say Tamil was originally TODO/fallback. Current AST inspection found no missing `ta` keys in main survey files, but equal-to-English values remain in some strings where English labels are intentional or need review.
- Some localized strings are still inline outside approved dictionary/survey files. ESLint reports `52` `no-restricted-syntax` violations, including `SurveyRunner`, `ResponseVisualSummary`, `analytics-report-i18n`, and `admin.tsx`.
- Consent content exists, but it should be reviewed by the research owner for plain-language comprehension, PII expectations, withdrawal process, and data retention wording.
- Admin/report copy is partly productized, but export warnings, retry language, request IDs, and PDF/report labels should be reviewed for consistency.
- `Changelog.md` is extensive and valuable, but it is large enough that future summaries or release groupings would make it easier to scan.
- SEO metadata is present on public routes, but canonical/OG behavior should be verified after the app can build and run.

## Suggested Improvements

- Add a compact "before you start" content block or equivalent on the intro step: estimated time, anonymity/privacy note, resume behavior, and optional contact expectations.
- Move all remaining SI/TA UI strings into approved dictionaries or widen the lint allowlist only where the architecture intentionally stores localized dictionaries.
- Run a research-owner copy review for consent and data-retention language.
- Add a content QA checklist for every new survey question: EN/SI/TA present, option values stable, labels clear, units explicit, and "Other" behavior defined.
- Standardize admin/export wording around "request ID", retry, partial export recovery, and validation warnings.
- Add short release summaries to the top of `Changelog.md` or start a rolling "latest changes" section.
- Verify route titles/descriptions/OG tags through SSR smoke tests once the dev/build blockers are fixed.

## Priority

- P0: Resolve inline SI/TA guardrail failures because they currently block lint.
- P1: Review consent/privacy copy before production research distribution.
- P2: Improve landing/start copy and admin/report consistency.
- P3: Add changelog summary conventions.

## Verification

- `./node_modules/.bin/eslint .` currently fails with `52` `no-restricted-syntax` violations for Sinhala/Tamil outside allowed files.
- AST inspection of main dictionary/survey files found no missing `si` or `ta` properties, but same-as-English entries need human review.
- SEO and rendered copy were not browser-verified because local dev/e2e are blocked by missing Bun and Rollup native loading.

## Related Files

- `src/routes/index.tsx`
- `src/routes/s.$slug.tsx`
- `src/routes/__root.tsx`
- `src/lib/i18n.tsx`
- `src/surveys/consent.ts`
- `src/surveys/phase-1.ts`
- `src/surveys/phase-3.ts`
- `src/lib/analytics-report-i18n.ts`
- `Changelog.md`
