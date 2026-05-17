# Accessibility Audit

## Current State

The app includes many accessibility-oriented features: focus movement on question changes, validation alert banners, aria-live progress/status regions, keyboard navigation, reduced-motion checks, role-based choice controls, accessible admin progress bars, and tests named with `.a11y`.

## Findings

- `QuestionView` moves focus to the heading on question changes and to the invalid control after validation errors. This is a strong baseline.
- Sticky action buttons include aria labels, and progress components expose `aria-valuenow` in key places.
- `QuestionMap`, optional consent cards, export progress cards, and alerts use roles/live regions in several places.
- There is one React hooks warning in `SurveyRunner.tsx` from `react-hooks/exhaustive-deps`; hook correctness should be reviewed before relying on focus behavior.
- Some complex custom controls use button plus ARIA roles instead of native form controls. This is workable, but it needs real assistive technology testing.
- Multilingual screen-reader behavior needs validation. `html lang` is prehydrated, but mixed language fragments inside the page may still need correct language context.
- The app uses motion heavily. Many components honor `prefers-reduced-motion`, but this should be audited as a complete journey rather than component by component.
- Inline SI/TA lint failures may indicate localized labels are not consistently routed through the same accessibility-friendly translation layer.

## Suggested Improvements

- Add a manual a11y test script for respondent flow: keyboard-only, VoiceOver/NVDA, reduced motion, zoom at 200 percent, and mobile screen reader.
- Fix the `SurveyRunner` hook warning or document why the dependency is intentionally omitted with a targeted comment.
- Verify every custom choice group announces question, option label, selected state, required state, and error state.
- Add automated tests for resume strip reveal/copy, question map drawer focus return, and admin export progress live regions if not already covered.
- Ensure language changes update `html lang` and that long SI/TA text is not announced under an English language context.
- Check color contrast of muted text, destructive borders, chart colors, badges, and gradient card text.
- Audit focus trap boundaries around consent/questions to ensure keyboard users can reach language toggle, map, and sticky controls without dead ends.

## Priority

- P0: Restore browser/e2e ability for a real a11y pass.
- P1: Resolve hook warning and custom-control announcement risks.
- P1: Validate multilingual screen-reader behavior.
- P2: Expand a11y regression tests around complex admin and resume/export states.

## Verification

- `./node_modules/.bin/eslint .` reports one `react-hooks/exhaustive-deps` warning in `SurveyRunner.tsx`.
- Source search found extensive use of `aria-*`, `role`, `aria-live`, and focus management across respondent and admin components.
- Playwright/a11y browser verification is currently blocked by missing Bun.

## Related Files

- `src/components/SurveyRunner.tsx`
- `src/components/survey/QuestionView.tsx`
- `src/components/survey/OptionalConsentPanel.tsx`
- `src/components/survey/QuestionMap.tsx`
- `src/components/survey/ReviewPanel.tsx`
- `src/components/FocusTrap.tsx`
- `src/components/QuestionCount.tsx`
- `src/routes/admin.tsx`
- `src/components/admin/AllValidProgressCard.tsx`
- `src/components/admin/ZipBundleProgressCard.tsx`
