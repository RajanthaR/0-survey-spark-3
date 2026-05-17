# Multilanguage And I18n Audit

## Current State

The app supports English, Sinhala, and Tamil using a `Lang` union, `LocalizedString`, `pickText`, `UI`, survey dictionaries, language persistence in localStorage, pre-hydration language setup, and `:lang(si)`/`:lang(ta)` font stacks. ESLint restricts Sinhala/Tamil glyphs outside approved locations.

## Findings

- Main UI and survey definitions include EN/SI/TA values. Quick AST inspection found no missing `si` or `ta` fields in `src/lib/i18n.tsx`, `src/surveys/phase-1.ts`, `src/surveys/phase-3.ts`, `src/surveys/types.ts`, and `src/surveys/consent.ts`.
- Survey source comments still say Tamil was TODO/fallback. Those comments may be stale or may indicate translations need human validation.
- ESLint currently reports `52` Sinhala/Tamil inline string violations outside the approved dictionary/survey/test paths.
- `pickText` warns in dev when non-English translations fall back to English, which is useful.
- Pre-hydration script sets `window.__eipLang` and `document.documentElement.lang`, reducing language flash.
- Some noun/number ordering is centralized through `QuestionCount`, which is good for SI/TA.
- The lint allowlist currently excludes some modules that appear dictionary-like, such as `analytics-report-i18n`, causing avoidable failures unless moved or allowlisted intentionally.
- Locale-sensitive formatting for dates, percentages, counts, and exported labels should be reviewed across admin reports and downloads.

## Suggested Improvements

- Resolve all `no-restricted-syntax` findings by moving localized strings into approved dictionaries or expanding the allowlist for true dictionary modules.
- Update stale survey comments after a translator confirms Tamil quality.
- Add an i18n completeness test that scans `LocalizedString` objects for missing EN/SI/TA where required.
- Add a "same as English" review report so intentional values like IDs/units are separated from untranslated copy.
- Centralize admin/report localized strings in one approved module and wire ESLint to allow that location.
- Verify text fit and font rendering in SI/TA on mobile and desktop.
- Confirm exported CSV/XLSX/codebook labels use the requested language consistently.

## Priority

- P0: Fix inline localized string lint violations.
- P1: Add automated completeness and same-as-English reports.
- P1: Translator review of stale TODO/fallback comments.
- P2: Locale formatting and export label QA.

## Verification

- `./node_modules/.bin/eslint .` reports `52` `no-restricted-syntax` issues for Sinhala/Tamil glyph placement.
- AST inspection found no missing SI/TA properties in main dictionary/survey files, but same-as-English values exist and need human review.
- Browser rendering was not verified because local dev/e2e are blocked.

## Related Files

- `src/lib/i18n.tsx`
- `src/lib/format.ts`
- `src/lib/analytics-report-i18n.ts`
- `src/surveys/phase-1.ts`
- `src/surveys/phase-3.ts`
- `src/surveys/types.ts`
- `src/surveys/consent.ts`
- `src/components/QuestionCount.tsx`
- `src/components/LanguageToggle.tsx`
- `eslint.config.js`
