# App audit — EIP Insight

A trilingual (EN/SI/TA) research survey runner with mobile-first UX, save-and-resume, and an admin analytics dashboard. Stack: TanStack Start, Supabase, Tailwind, framer-motion, recharts.

Overall the architecture is solid: server functions are correctly used, RLS is on, resume tokens are random, the SSR error boundary + smoke test are in place. The issues below are the gaps worth fixing — grouped by severity.

---

## 🔴 Critical — security / correctness

1. **Public can write to `responses` only via service-role server fns, with no rate limit or abuse guard.**
   `startResponse` / `saveAnswers` / `completeResponse` use `supabaseAdmin` and are unauthenticated — anyone can spam-create rows or overwrite any in-progress response if they can guess/steal a `resume_token` (18 random bytes is fine, but tokens are also embedded in shareable URLs and `localStorage`).
   - Add a per-IP rate limit (simple in-memory or KV) on `startResponse`.
   - Add a `hcaptcha`/`turnstile` check before `startResponse` (Cloudflare Turnstile is free and Worker-friendly).
   - Consider rotating the resume token on `completeResponse` so a leaked link can't reopen a finished survey.
   - Block `saveAnswers`/`completeResponse` when `status = 'completed'` (currently a completed row can be silently re-edited).

2. **No size cap on `answers` payload.** A malicious client can POST a huge JSON blob. Add `z.string().max()` on text fields and a total payload byte check (e.g. reject `JSON.stringify(answers).length > 64 KB`).

3. **`adminBootstrap` auto-promotes the first signed-in user to admin** with no out-of-band confirmation. If signups are open, an attacker who beats the legit researcher to the first signup owns the dashboard. Either:
   - Disable signup in the UI once any user exists, **or**
   - Bootstrap admin via a one-time `ADMIN_BOOTSTRAP_EMAIL` env var instead of "first wins".

4. **Email confirmation is not enforced.** Verify Supabase Auth has "Confirm email" ON, and remove the optimistic `toast.success("Account created…")` fallback that suggests it might be disabled.

---

## 🟠 High — UX / data quality

5. **`SurveyRunner` save-on-Next blocks navigation behind a network round-trip** (`await saveNow(); goNext()`). On flaky mobile this stalls the form. Make saves fire-and-forget with optimistic local state, surface failures via toast + retry queue.

6. **Auto-save interval (10s) runs even when answers haven't changed**, and there's no save on `visibilitychange`/`pagehide`. Switch to: debounce on answer change (1.5s) + flush on tab hide via `navigator.sendBeacon` or a final fetch in `pagehide`.

7. **Resume URL is shown unconditionally in the sticky bar** including the raw token — this is the only secret protecting the response. Hide behind a "Get my resume link" button and warn it should be kept private.

8. **No validation feedback on questions other than `required`.** Email/tel/number-range types exist in `Question` but have no per-type validation in `Field`/`isAnswered`.

9. **Conditional logic only checks equality.** `showIf` can't express "answered", "not equals", or numeric comparisons — limiting for branching surveys. Extend to `{ op: "eq" | "neq" | "in" | "answered", value? }`.

10. **Idx/visibility race**: when a `showIf` branch hides earlier questions, `idx` is clamped but the user can land mid-survey on an unrelated question. Track current question by `id`, not by index, so visibility shifts don't jump the cursor.

11. **`progressFor` counts ALL visible questions including unanswered required ones**, so a fresh form shows 0%. Fine, but the runner shows progress only in `questions` stage — also surface it on the consent screen and in the resume email so respondents know what they're committing to.

12. **No pre-submit review screen.** Mobile responders can't see what they're submitting. Add a compact summary step before `contact`.

---

## 🟡 Medium — admin dashboard

13. **`getStats` / `listResponses` cap at 2000 / 500 rows** with no pagination — silently wrong once data grows. Add server-side aggregation (a `survey_stats` SQL view) and paginated `listResponses(cursor)`.

14. **CSV export pulls full rows into the Worker, builds a string, returns it via JSON**, which doubles memory and blows the response-size cap on Workers (~25 MB) for big exports. Stream NDJSON or generate the CSV in a server route that returns `text/csv` directly (`/api/admin/export.csv?slug=…` with admin-cookie check).

15. **Daily series doesn't include zero-days**, so the line chart looks gappy. Fill missing days client-side or in SQL with `generate_series`.

16. **Tabs use `__all__` sentinel** — fine, but `SURVEY_LIST.map(s => s.title.en)` ignores admin language preference. Use `pickText`.

17. **No section-completion view**, even though `sectionBreakdown` exists in `survey-logic.ts` and the user originally asked for "by section". Wire it into the dashboard.

18. **Admin login has no "forgot password" flow** and no rate-limit guard against credential stuffing.

---

## 🟢 Lower priority — polish & DX

19. **i18n coverage is incomplete** — Tamil strings in `phase-1` are TODO in many places; `pickText` silently falls back to EN. Add a dev-only console warning when a non-English language renders an EN fallback so gaps are visible.

20. **`useLang` reads `localStorage` only on mount** → first paint is always EN, then snaps to user's saved language (visible flash). Read in a script tag in `__root` shellComponent before hydration, or set `<html lang>` from the stored value.

21. **`__root.tsx`** missing `onAuthStateChange` → router invalidate. After admin sign-out, stale stats stay on screen until manual reload (per the `tanstack-supabase-integration` knowledge).

22. **Index page** uses a generic app `<title>` — set per-route SEO metadata (title, description, og tags) for `/`, `/s/$slug`, `/admin`.

23. **`Question.help` is shown but never sanitized** — fine today since it's static, but if you ever load survey JSON dynamically, escape or render via plain text.

24. **Bundle size**: framer-motion + recharts + radix everywhere. Lazy-load `recharts` and the admin route (`React.lazy` + route-level code split) so respondents on 3G don't pay for the dashboard.

25. **Tests**: only the SSR smoke test exists. Add Vitest unit tests for `survey-logic.ts` (`isVisible`, `progressFor`, `sectionBreakdown`) and a Playwright happy-path that completes phase-1 in EN.

26. **Accessibility**:

- Sticky bottom bar's "Save" icon-only button has no `aria-label` on small screens.
- Progress bar has no `aria-valuenow`.
- Color-only state on status badges — add text or icon.
- Verify Sinhala/Tamil fonts load (no `@font-face` for Noto Sans Sinhala/Tamil seen in `styles.css`).

27. **`db/schema.sql`** is now drifting from the actual Supabase state (RLS policies are commented out in the file but live in the DB). Either generate from `supabase db diff` or add a note that the live RLS lives in migrations.

---

## Suggested order of work

```text
Sprint 1 (security + abuse)
  3. Lock down adminBootstrap
  1. Rate limit + Turnstile on startResponse
  2. Payload size cap + completed-row write block
  21. Wire onAuthStateChange in __root

Sprint 2 (respondent UX)
  5+6. Fire-and-forget + debounced save + sendBeacon
  7. Hide resume token behind explicit action
  10. Track current question by id
  12. Pre-submit review screen
  8+9. Per-type validation + richer showIf

Sprint 3 (admin)
  17. Section-completion panel
  13+14. Pagination + streaming CSV
  15+16. Zero-fill daily, localized tab labels

Sprint 4 (polish)
  19+20. i18n gap warnings + pre-hydration lang
  22. Per-route SEO
  24. Lazy-load admin + recharts
  25. Unit + Playwright tests
  26. A11y pass
```

## Open question for you

The biggest call is **#3 (admin bootstrap)** and **#1 (abuse protection)** — both change user-visible behavior. Want me to start with the Sprint 1 security fixes, or pick a specific item from the list?

---

## Sprint 4 progress (post-implementation)

- ✅ #19 Dev-only `console.warn` in `pickText` when SI/TA falls back to EN
- ✅ #20 Pre-hydration `<script>` in `__root` reads `eip.lang` from localStorage and sets `<html lang>` + `window.__eipLang`; `I18nProvider` now initializes from that on first render — no more EN flash
- ✅ #22 Per-route `head()` on `/`, `/s/$slug`, `/admin`, `/reset-password`; root metadata branded; `noindex` on admin + reset-password; canonical/og:url on public pages
- ✅ #24 `recharts` extracted to `src/components/admin/DashboardCharts.tsx` and lazy-loaded via `React.lazy` + `Suspense` — respondents no longer download the charting bundle
- ✅ #25 `vitest` installed + `src/lib/__tests__/survey-logic.test.ts` covers `isVisible` (eq/neq/answered/legacy), `progressFor`, `visibleQuestions`, `sectionBreakdown` (9 tests, all passing). Scripts: `bun run test`, `bun run test:watch`. Playwright happy-path deferred (browser infra)
- ✅ #26 A11y: aria-labels on icon-only admin buttons, status badges now show text + icon (not color-only), Noto Sans Sinhala/Tamil loaded via Google Fonts and applied with `:lang(si)` / `:lang(ta)` selectors

Outstanding: #1 Turnstile, #18 login rate-limit (both need backend rate-limit primitives the platform doesn't yet provide), Playwright e2e.
