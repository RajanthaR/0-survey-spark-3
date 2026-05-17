# P5 Wave-1 — 8 parallel prompts

Fire each `## Prompt N.M` section as a **separate** Codex agent.

**Depends on:** P3 fully merged.
**Note:** 5.1/5.2/5.3 all touch `__root.tsx`. If you only have 1 agent
free for those three, serialise them. If you have 3 agents, mind the
merge order: 5.1 → 5.2 → 5.3 (smallest diff first).

| Prompt | Owns | Touches |
| --- | --- | --- |
| 5.1 | skip-link + Back label | `__root.tsx`, `SurveyRunner.tsx` |
| 5.2 | localise error pages | `__root.tsx`, `s.$slug.tsx`, `i18n.tsx` |
| 5.3 | html-lang + intro parity | `__root.tsx`, `index.tsx`, `i18n.tsx` |
| 5.4 | auto-advance UX | `SurveyRunner.tsx` (or hook from 3.3) |
| 5.5 | Likert aria-label | `QuestionView.tsx` |
| 5.6 | same-as-en report | new Vitest report |
| 5.7 | pickText misses gate CI | `i18n.tsx`, test setup |
| 5.8 | error rendering policy | many small + `docs/UX-PATTERNS.md` |

---

## Prompt 5.1 — Skip-link + visible Back label

ROLE: Senior engineer. Execute immediately. One PR. ~20 lines diff.
**Audit refs:** `audits/02-uiux.md` U-1 / U-4.

### TODO
1. Read `src/routes/__root.tsx` + `src/components/SurveyRunner.tsx` around the Back button.
2. Add a `sr-only`-by-default `<a href="#main">Skip to main content</a>` as the first focusable element in `__root.tsx`. Show on focus.
3. Add `id="main"` to the survey/runner main region.
4. Update Back button: visible `Back` label at `sm:` breakpoint; keep `aria-label` for icon-only mobile.
5. New test: `src/test/a11y-skip-link.test.tsx` asserting focusable first element.

### Verification
```bash
bun run test src/test/a11y-skip-link.test.tsx
bunx --bun @axe-core/cli http://localhost:5173/ --exit
```

### Commit & PR
- Branch: `a11y/skip-link-back-label`
- Commit: `a11y: skip-link + visible Back label on sm [5.1]`

---

## Prompt 5.2 — Localise 404 / 500 / not-found

ROLE: Senior engineer. Execute immediately. One PR.
**Audit ref:** `audits/02-uiux.md` U-11, `audits/08-i18n.md` I-5.

### TODO
1. Read `src/routes/__root.tsx:19-74`, `src/routes/s.$slug.tsx:84-90`, `src/lib/error-page.ts` (if exists), `src/lib/i18n.tsx`.
2. Add to `UI`: `notFoundTitle`, `notFoundBody`, `errorTitle`, `errorBody`, `surveyNotFound` — all with EN/SI/TA.
3. Update each error path to use `pickText(UI.<key>, lang)`.
4. Tests: navigate to non-existent slug in each language, assert localized strings render.

### Verification
```bash
bun run test src/routes/__tests__
bun run typecheck
```

### Commit & PR
- Branch: `i18n/localise-error-pages`
- Commit: `i18n: localise 404, 500, survey-not-found [5.2]`

---

## Prompt 5.3 — Intro parity + researcher CTA + html-lang

ROLE: Senior engineer. Execute immediately. One PR.
**Audit refs:** `audits/01-content.md` C-4, `audits/08-i18n.md` I-4 / I-6.

### TODO
1. Read `src/lib/i18n.tsx` (UI.intro and surrounding), `src/routes/__root.tsx`, `src/routes/index.tsx:70`.
2. Bring SI/TA `intro` strings up to EN length + tone. Leave a `<TODO: translator review>` if uncertain.
3. Add `UI.researcherLogin` EN/SI/TA. Update `index.tsx:70` to use `pickText`.
4. Confirm `__root.tsx` server-renders `<html lang>` from cookie (landed in 2.5). If still inline-script-driven, finish the migration.

### Verification
```bash
bun run typecheck && bun run test
curl -s --cookie "lang=ta" http://localhost:5173/ | grep '<html[^>]*lang="ta"'
```

### Commit & PR
- Branch: `i18n/intro-parity-html-lang`
- Commit: `i18n: intro parity + localised researcher CTA + html-lang [5.3]`

---

## Prompt 5.4 — Auto-advance UX tuning

ROLE: Senior engineer. Execute immediately. One PR. ~15 lines diff.
**Audit ref:** `audits/02-uiux.md` U-5.

### TODO
1. Find auto-advance in `src/components/SurveyRunner.tsx` or the `useStageMachine` hook (3.3).
2. Bump delay from ~220ms → 500ms.
3. Skip auto-advance when the latest input was a keyboard event — track via a `lastInputKindRef` updated on `keydown` / `pointerdown`.
4. New test asserting keyboard selection does not auto-advance.

### Verification
```bash
bun run test src/components/__tests__/SurveyRunner.autoAdvance.test.tsx
```

### Commit & PR
- Branch: `ux/auto-advance-tuning`
- Commit: `ux(survey): kinder auto-advance for keyboard + SR users [5.4]`

---

## Prompt 5.5 — Likert aria-label richness

ROLE: Senior engineer. Execute immediately. One PR. ~5 lines diff.
**Audit ref:** `audits/02-uiux.md` U-8, `audits/08-i18n.md` I-7.

### TODO
1. Read `src/components/survey/QuestionView.tsx` Likert block (~288-302).
2. Change `aria-label={String(n)}` to `aria-label={\`${n}: ${pickText(option.label, lang)}\`}`.
3. Test: render Likert; assert each radio's `aria-label` includes option text.

### Verification
```bash
bun run test src/components/survey/__tests__/QuestionView.likert.a11y.test.tsx
```

### Commit & PR
- Branch: `a11y/likert-aria-label`
- Commit: `a11y(likert): rich aria-label including option text [5.5]`

---

## Prompt 5.6 — Same-as-English review report

ROLE: Senior engineer. Execute immediately. One PR. New test only.
**Audit ref:** `audits/13-codex-parity-supplement.md` S-18.

### TODO
1. New `src/lib/__tests__/i18n-same-as-english.test.ts` that walks every dictionary file (`i18n.tsx`, `surveys/*.ts`, `analytics-report-i18n.ts`).
2. For each `LocalizedString`, if `si === en` or `ta === en`, record under `coverage/same-as-english.json`.
3. Test does not fail — it writes the report and prints a summary count.
4. Wire to CI as an artifact upload step in `pr.yml` (non-gating).

### Verification
```bash
bun run test src/lib/__tests__/i18n-same-as-english.test.ts
test -f coverage/same-as-english.json
```

### Commit & PR
- Branch: `test/same-as-english-report`
- Commit: `test(i18n): same-as-english review report (non-gating) [5.6]`

---

## Prompt 5.7 — `pickText` misses gate CI

ROLE: Senior engineer. Execute immediately. One PR.
**Audit ref:** `audits/13-codex-parity-supplement.md` S-17.

⚠ May surface previously-silent fallbacks. If count > 20, defer the gate and file follow-ups instead.

### TODO
1. Read `src/lib/i18n.tsx` dev-warning code path.
2. Hoist the fallback warning into a module-level counter (export `__pickTextMissCount` for tests).
3. In `src/test/setup.ts`, add an `afterEach` that asserts the counter is 0 then resets.
4. Run full suite; if > 20 new failures, abort, file the list, defer the gate to a follow-up.

### Verification
```bash
bun run test
```

### Commit & PR
- Branch: `i18n/picktext-gate`
- Commit: `i18n: pickText misses fail tests in CI [5.7]`

---

## Prompt 5.8 — Error rendering policy + apply

ROLE: Senior engineer. Execute immediately. One PR.
**Audit ref:** `audits/02-uiux.md` U-7.

### TODO
1. Decide and write `docs/UX-PATTERNS.md`:
   - Validation → in-page `<div role="alert">` banner.
   - Network-ephemeral → toast.
   - Irrecoverable → full-page error.
2. Audit existing call sites:
   - `grep -rn "toast\\|sonner" src/`
   - Replace save-error toasts with `role="alert"` banners where validation-like.
3. Don't change the irrecoverable-error path (it already uses a full page).

### Verification
```bash
bun run typecheck && bun run test
```

### Commit & PR
- Branch: `ux/error-rendering-policy`
- Commit: `ux: error rendering policy + apply across stages [5.8]`
