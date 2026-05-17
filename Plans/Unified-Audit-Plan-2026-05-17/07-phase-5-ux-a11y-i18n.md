# Phase 5 — UX, Accessibility, i18n polish

## Goal

Every public route is fully localised (EN / SI / TA) including error
pages. WCAG 2.1 AA pass on `/` and `/s/$slug`. The "intro" hook is
parity across languages. Auto-advance feels right.

## Why now

P3 left a clean component surface and P0–P2 stabilised tests. UX/a11y
work in earlier phases would have caused massive merge conflicts.

## Sources

- `audits/02-uiux.md` (U-1 to U-15)
- `audits/08-i18n.md` (I-1 to I-8)
- `audits/01-content.md` (C-1 to C-8)
- `audits/13-codex-parity-supplement.md` (S-17 / S-18)
- `Codex-audits/02-ui-ux-audit.md`, `03-accessibility-audit.md`,
  `09-multilanguage-i18n-audit.md`

## Codex Sessions

### Session 5.1 — Skip-to-main-content + visible-on-sm Back label (XS, ~30m)

```text
Goal: WCAG 2.4.1 + voice-control parity on the icon-only Back button.

Edits:
1. Add a sr-only-by-default <a href="#main"> as the first focusable
   element in src/routes/__root.tsx.
2. Add id="main" to the survey/runner main region.
3. Update the Back button at SurveyRunner.tsx:812 to show a visible
   "Back" label at sm: breakpoint while keeping aria-label for icon-only.

Verification:
- axe-core: zero violations on / and /s/phase-1.
- VoiceOver: "Back, button" announces correctly.

Commit: "a11y: skip-link + visible Back label on sm".
```

### Session 5.2 — Localise 404, 500, "Survey not found" (S, ~1h)

```text
Goal: useLang() drives copy on every error route.

Read:
- src/routes/__root.tsx:19-74
- src/routes/s.$slug.tsx:84-90
- src/lib/error-page.ts

Edits:
1. Add UI.notFoundTitle / UI.notFoundBody / UI.errorTitle / UI.errorBody
   to src/lib/i18n.tsx with EN/SI/TA.
2. Update each error page to call pickText.
3. Tests: walk to a non-existent slug in each language; assert localized
   copy.

Commit: "i18n: localise 404, 500, and survey-not-found pages".
```

### Session 5.3 — `<html lang>` + intro parity + researcher CTA (S, ~1h)

```text
Goal: Parity for the recruitment hook + researcher login affordance.

Edits:
1. Bring SI/TA `intro` strings up to the EN length (current SI/TA are
   shorter — see audits/01-content.md C-4). Ask the translator if any.
2. Add UI.researcherLogin EN/SI/TA. Update src/routes/index.tsx:70 to
   use pickText.
3. Confirm src/routes/__root.tsx is server-rendering <html lang> from
   the cookie (landed in 2.5). If not, finish the migration.

Verification:
- Visit / in each language; intro is at parity length and tone.
- View-source shows correct <html lang> on first byte.

Commit: "i18n: intro parity + localised researcher CTA".
```

### Session 5.4 — Auto-advance UX tuning (XS, ~30m)

```text
Goal: Auto-advance after single-choice / yes-no waits 500ms and
skips when triggered by keyboard.

Read:
- src/components/SurveyRunner.tsx (find the auto-advance branch)

Edits:
1. Bump delay from 220 → 500ms.
2. Skip auto-advance when the latest input event was a keyboard key
   (track via a useRef on keydown).
3. Add a unit test asserting keyboard selection does not auto-advance.

Commit: "ux(survey): kinder auto-advance for keyboard + screen-reader users".
```

### Session 5.5 — Likert aria-label richness (XS, ~30m)

```text
Goal: VoiceOver reads "5: Strongly agree" not just "5".

Edits:
- src/components/survey/QuestionView.tsx Likert block (~288-302).
- aria-label = `${n}: ${pickText(option.label, lang)}`.

Commit: "a11y(likert): rich aria-label including option text".
```

### Session 5.6 — Same-as-English review report (S, ~2h)

```text
Goal: Vitest report listing every LocalizedString whose si or ta value
equals the en value, grouped by file.

Read:
- audits/13-codex-parity-supplement.md S-18

Edits:
1. New test src/lib/__tests__/i18n-same-as-english.test.ts that walks
   every dictionary file (i18n.tsx + surveys/*.ts + analytics-report-i18n.ts)
   and asserts: for each LocalizedString, if si === en or ta === en,
   record it as a finding (not a failure). Output the report to
   coverage/same-as-english.json.
2. Wire to CI as an artifact (not a gate yet).

Commit: "test(i18n): same-as-english review report (non-gating)".
```

### Session 5.7 — `pickText` fallback warning → CI gate (S, ~1h)

```text
Goal: A test run with NODE_ENV=test fails if any pickText falls back
because of a missing key.

Read:
- src/lib/i18n.tsx (the dev-warning code path)

Edits:
1. Hoist the fallback-warning into a counter that increments on each
   miss.
2. Add a test setup teardown asserting `pickTextMissCount === 0` per file.
3. CI gates this.

Commit: "i18n: pickText misses fail tests in CI".
```

### Session 5.8 — Standardise error rendering policy (S, ~1h)

```text
Goal: One pattern per severity. Document it.

Edits:
1. Decide:
   - Validation: in-page <role="alert"> banner.
   - Network ephemeral: toast.
   - Irrecoverable: full-page error.
2. Apply to existing call sites; remove ad-hoc toasts on save errors.
3. docs/UX-PATTERNS.md captures the rule.

Commit: "ux: error rendering policy + apply across stages".
```

### Session 5.9 — Manual a11y sweep with Computer Use (S, ~2h)

```text
Goal: Screen-reader walkthrough on macOS VoiceOver in EN/SI/TA.

Steps:
1. bun run dev
2. Cmd-F5 to enable VoiceOver.
3. Walk consent → questions → review → contact → done in EN.
4. Repeat in SI and TA.
5. Note every announcement issue (missing label, language flip,
   focus jump). File issues; fix the easy ones.

Output:
- Plans/Unified-Audit-Plan-2026-05-17/a11y-report-2026-05-17.md.
```

## Verification (whole phase)

```sh
bun run typecheck && bun run lint && bun run test
bun run test:e2e -- --grep "language-toggle|review|done"
# Lighthouse: a11y >= 95 on / and /s/phase-1.
# axe-core: zero serious violations.
```

## Done criteria

- [ ] 5.1 Skip-link + Back label.
- [ ] 5.2 404 / 500 / not-found localised.
- [ ] 5.3 Intro parity + researcher CTA localised.
- [ ] 5.4 Auto-advance tuned.
- [ ] 5.5 Likert aria-label improved.
- [ ] 5.6 Same-as-english report.
- [ ] 5.7 pickText misses gate CI.
- [ ] 5.8 Error rendering policy applied + documented.
- [ ] 5.9 Manual a11y sweep + report.
- [ ] axe-core 0 serious; Lighthouse a11y >= 95.

## Breaking-change flags

- 5.7 will turn previously-silent fallbacks into hard failures. Run a
  pre-flight to enumerate them and fix them in 5.6/5.7 before flipping
  the gate.
