# Audit 02 — UI / UX & Accessibility

Scope: visual design system, mobile-first layout, respondent flow, animations,
focus management, screen-reader contracts, keyboard support.

## Strengths

- **Mobile-first, thumb-first.** Sticky CTA bar with `safe-bottom`, 56 px primary button, 48 px secondary, and 56 px choice cards (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:803-869`, `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/survey/QuestionView.tsx:202-230`).
- **Multimodal navigation.** Tap, swipe (pointer events, x/y dominance check), keyboard (`Home`, `End`, `Arrow`, `PageUp/Down`) all work (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:349-426`).
- **Focus management.** `<FocusTrap>` wraps each stage, focus returns to Next/Back after every transition, headings are focused on mount, error banner shifts focus into the invalid field (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/survey/QuestionView.tsx:55-108`, `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:435-448`).
- **Reduced-motion is honoured everywhere.** `useReducedMotion()` short-circuits springs, slide offsets, and the rainbow-glow keyframes (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/styles.css:177-181`).
- **Trilingual font stacks.** `:lang(si)` / `:lang(ta)` swap to Noto Sans Sinhala / Tamil (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/styles.css:114-119`); preloaded via `<link rel="preconnect">` in `__root` (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/__root.tsx:138-145`).
- **Resume + review.** Resume URL is persisted to localStorage and surfaced via `<ResumeStrip>`. A dedicated `<ReviewPanel>` lets users edit before submit (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/survey/ReviewPanel.tsx`).
- **`prefers-reduced-motion` + `aria-live`.** Progress chip uses `aria-live="polite"` style updates and `tabular-nums`.

## Findings

### U-1 — Icon-only Back button has only `aria-label`, no visible text on small screens _(a11y)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:812-822` renders just `<ArrowLeft />` with `aria-label`. Voice-control users (e.g. iOS Voice Control) sometimes need a visible label to invoke a control by name. Consider adding `sr-only` text or a visible-on-`sm` label like Save & exit does.

### U-2 — Survey root `<header>` does not carry `lang`

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/__root.tsx:163` hard-codes `<html lang="en">` and relies on the pre-hydration `<script>` to set it post-load (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/__root.tsx:147-152`). For SSR'd HTML viewed by crawlers or with JS disabled, the `lang` is wrong on the first byte. Read the cookie / hint header on the server and emit the correct `lang` directly.

### U-3 — Resume token is exposed in the survey URL bar

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:162-165` constructs `?token=…` and the runner mirrors it into the address bar via `navigate({ replace: true, search: { token } })` (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:238-243`). This means the token leaks into:

- Browser history.
- Server access logs (CF analytics + Supabase).
- Screen-sharing recordings.

`completeResponse` rotates the token on submission, which mitigates _post-submit_ replay (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/responses.functions.ts:144-160`), but an in-progress token is still long-lived. Options: keep the token in `localStorage` + remove from URL after first resume, or hash the URL fragment instead (`#token=…`, never sent to servers).

### U-4 — `<header>` lacks a `<main>` skip-link

There is a sticky header on every page and no skip-to-content link, which is a WCAG 2.1 §2.4.1 requirement.

### U-5 — Single-choice + yes/no auto-advance after 220 ms surprise

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:702-703` auto-advances after selection. This is great for thumb-first flows but breaks expectations for keyboard users and screen-reader users who haven't heard their selection echo back yet. Either:

- Trigger auto-advance only on `pointer` events (skip keyboard).
- Show a small "advancing in 1s" affordance with cancellation.
- Bump the delay to ~500 ms so the active state can be confirmed visually + announced.

### U-6 — Animations on first paint may flash a wrong size

The `<motion.section>` initial state uses `opacity: 0, x: 24 * direction` and the question card mounts inside `<AnimatePresence mode="wait">` (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/survey/QuestionView.tsx:114-122`). On slow Sri Lankan 3G, the initial pre-hydration HTML shows the card at `opacity:0` for up to ~1s before Framer hydrates. Consider matching the initial CSS to the hydrated value (i.e. `opacity:1`) and only animate _between_ questions, not on first paint.

### U-7 — Error states inconsistent across stages

The questions stage uses an in-page `<role="alert">` banner (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/survey/QuestionView.tsx:131-149`), while save errors at the consent and contact stages use `toast.error()` (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:259-263`). Toasts disappear automatically; in-page banners persist. Pick one pattern per severity and document it.

### U-8 — Likert grid uses `aria-label={String(n)}` only

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/survey/QuestionView.tsx:288-302` labels Likert buttons "1" through "5". Screen readers won't read "Strongly agree". Add a richer label, e.g. `aria-label={`${n}: ${pickText(o.label, lang)}`}`.

### U-9 — Progress chip is decorative + redundant with progress bar

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:522-531` shows `pct%` next to the `<Progress aria-valuenow={pct}>` (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:533-544`). Hide one from SR with `aria-hidden="true"` to avoid double-announcing.

### U-10 — "Continue anyway" Turnstile bypass surfaces a developer-only escape hatch to end-users on `localhost`

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:658-680`. The label "Continue anyway" should be gated behind a developer-tools query string (e.g. `?dev=1`) instead of any `localhost` host, to avoid confused testers in CI screenshots or staging environments mistakenly served from `localhost` tunnels.

### U-11 — `404`, `500`, "Survey not found" pages are not localised

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/__root.tsx:19-39`, `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/__root.tsx:41-74`, and `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/s.$slug.tsx:84-90` show English-only copy. Honour `useLang()` so respondents who arrive from a Sinhala or Tamil link don't get yanked back to English at a failure boundary.

### U-12 — Color-contrast risk in `gradient-eco` text

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/index.tsx:40-44` overlays cream text on a green→moss gradient. Spot-check WCAG AA (4.5:1) for normal text and AAA (7:1) at the brightest stop of the gradient — `oklch(0.62 0.16 155)` may dip below AA against `oklch(0.985 0.012 95)`.

### U-13 — Touch swipe surface conflicts with text-input scrolling

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:351-388` opts out of swipe when the pointer started on `INPUT/TEXTAREA/SELECT/BUTTON`, but not when it starts inside a long help text or scroll-only region. On long_text questions with `rows={4}` (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/survey/QuestionView.tsx:306-313`), pull-to-scroll inside the textarea is fine, but pulling outside it can navigate away mid-typing.

### U-14 — No "Are you sure?" guard on the auto-rotate on completion

`completeResponse` rotates the token on submit (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/responses.functions.ts:144-160`). If the user accidentally double-taps submit before the toast fires, the second call fails because the resume token is now stale. The current flow guards against `status === completed` server-side, but the client should also disable the Submit button while `busy` (already done — `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:769-775`). Good. Verify the same on the Save & exit path.

### U-15 — No "Are you a human?" Turnstile UX hint when the widget is loading

The `OptionalConsentPanel` shows the Turnstile iframe but no skeleton or loading text. If the user is on a slow network, the consent screen appears empty between "Agree" and the Turnstile widget rendering.

## Suggested improvements (UI / UX)

1. Move resume token out of the URL bar; persist via `localStorage` only or use a URL fragment.
2. Read language from a cookie/hint header server-side and emit `<html lang>` on the first byte (fixes #U-2 + SSR + crawler).
3. Localise 404, 500, and "Survey not found" pages.
4. Add a global "Skip to main content" link.
5. Bump auto-advance delay for `single_choice` / `yes_no` to ~500 ms and skip when triggered by keyboard.
6. Add richer `aria-label` on Likert buttons (`"5: Strongly agree"`).
7. Mark the duplicated percent chip `aria-hidden="true"`.
8. Replace icon-only Back button with visible label on `sm:` breakpoint.
9. Standardise error rendering: in-page banner for validation, toast for ephemeral network errors, modal for irrecoverable state.
10. Gate the dev-only "Continue anyway" bypass behind `?dev=1` instead of host detection.
11. Run a contrast pass on `gradient-eco` overlays at every breakpoint.
12. Add a Turnstile loading skeleton on the consent screen.
13. Confirm `prefers-reduced-motion` regression coverage in Playwright on every release.
14. Add Lighthouse / axe-core in CI and fix any new warnings before merging.
