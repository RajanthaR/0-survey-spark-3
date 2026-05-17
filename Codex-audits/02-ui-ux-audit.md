# UI/UX Audit

## Current State

The respondent experience is mobile-first and includes intro, required consent, optional consent, questions, review, contact, completion, language switching, autosave, resume links, question map, keyboard navigation, and swipe gestures. The admin route provides analytics, response lists, exports, codebooks, validation reports, alerts, and live status controls.

## Findings

- Respondent flow has many thoughtful affordances: review before submit, question map, progress, save/exit, keyboard navigation, swipe, and localized validation.
- The sticky bottom action bar is ergonomic, but the resume strip adds dense text in an already constrained mobile zone.
- `ResumeStrip` hides the raw token until reveal, which is good, but the reveal button label currently reuses copy-oriented language and could better say "Show link" or "Get link".
- The intro card uses a large rounded gradient treatment. It is visually distinctive, but should be checked against the app design guidance for compact operational surfaces and mobile first-viewport fit.
- Question auto-advance on single choice can reduce friction, but should be tested with screen readers and users who may accidentally tap an option.
- Admin dashboard breadth is high. Many workflows live in one route component, which can make orientation and task recovery harder for researchers.
- Admin export flows appear powerful, but progress/retry/recovery states should be tested in a real browser with slow network and large datasets.
- Live UI behavior has not been verified in browser after current tooling issues.

## Suggested Improvements

- Browser-test the full respondent path on small mobile, medium mobile, tablet, and desktop once dev server works.
- Rename the initial resume reveal button to a clearer action such as "Show link" while keeping the final copy button after reveal.
- Review sticky bar height plus resume strip on mobile safe-area devices to ensure it does not hide too much content.
- Add a user setting or clear interaction delay for auto-advance if accidental selection shows up in testing.
- Split admin workflows into clearer panels/modules with visible headings and stable task zones: overview, responses, exports, reports, settings.
- Add empty, loading, partial failure, retry, and completed states for every export/admin card if any are missing.
- Run a visual QA checklist for text fit in EN/SI/TA, especially buttons, badges, progress pills, and table controls.

## Priority

- P0: Restore local browser verification so UI/UX findings can be validated.
- P1: Verify respondent mobile flow, sticky controls, and resume reveal.
- P1: Improve admin workflow scannability during the route split.
- P2: Tune auto-advance and dense export UI based on manual testing.

## Verification

- Playwright could not run because `playwright.config.ts` starts `bun run dev`, and the shell reports `bun: command not found`.
- Source review covered `SurveyRunner`, `QuestionView`, `ReviewPanel`, `ResumeStrip`, `OptionalConsentPanel`, and `admin.tsx`.
- No new screenshots were captured because the dev server could not be started.

## Related Files

- `src/components/SurveyRunner.tsx`
- `src/components/survey/QuestionView.tsx`
- `src/components/survey/ReviewPanel.tsx`
- `src/components/survey/ResumeStrip.tsx`
- `src/components/survey/QuestionMap.tsx`
- `src/components/survey/OptionalConsentPanel.tsx`
- `src/routes/admin.tsx`
- `src/components/admin/AllValidProgressCard.tsx`
- `src/components/admin/ZipBundleProgressCard.tsx`
