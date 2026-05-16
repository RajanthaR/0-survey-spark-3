# Audit V2 — outstanding fixes

Re-audit performed 2026-05-15 against the current codebase. Several items from `Plans/post-audit-plan.md` are already shipped (payload size cap, completed-write block, `ADMIN_BOOTSTRAP_EMAIL` gating, lazy recharts, i18n fallback warnings, pre-hydration `<html lang>`, per-route SEO, Noto SI/TA fonts). What follows is the remaining work.

## Status snapshot (2026-05-15, end of day)

- **Sprint A (security):** ✅ 1, 3, 4, 5 shipped. ⏸ 2 (Turnstile) blocked on `TURNSTILE_SECRET` + `VITE_TURNSTILE_SITE_KEY`.
- **Sprint B (respondent UX):** ✅ 6, 7, 8, 9, 10, 11, 12 — all shipped in `SurveyRunner.tsx` / `survey-logic.ts`.
- **Sprint C (admin):** ✅ 15, 16, 17, 18 shipped. ✅ 13 partially (cursor pagination via `page`/`pageSize` on `listResponses`; `survey_stats` SQL view not yet created — current aggregate caps are still adequate). ⏳ 14 (streaming CSV at `/api/admin/export.csv`) outstanding.
- **Sprint D (refactor + DX):** ✅ 20, 21, 22, 23, 26 shipped. ⏳ 19 (split `admin.tsx`, 3,866 lines) — next mechanical refactor. ⏳ 24, 25 (tests + a11y pass on review screen) — not started.

## Outstanding work

1. **A2 — Turnstile bot challenge.** Needs the user to register a Cloudflare Turnstile site, then provide `TURNSTILE_SECRET` (server) and `VITE_TURNSTILE_SITE_KEY` (build). Then: render the widget on the consent screen and verify the token in `startResponse` before insert.
2. **C14 — Streaming CSV export.** Port `exportCsv` to a server route at `/api/admin/export.csv?slug=…` returning `text/csv` with the same admin-cookie check, dedup, and CRC32 the XLSX path uses. Frees Worker memory on large exports.
3. **C13 (remainder) — `survey_stats` SQL view.** Only needed if the 2000-row `getStats` cap becomes a real limit. Defer until response volume warrants it.
4. **D19/20/21 — Mechanical splits.** `admin.tsx` (3.8k lines), `SurveyRunner.tsx` (1.3k lines), `admin.functions.ts` (1.97k lines). No behavior change, but high diff volume + non-trivial review burden. Worth a dedicated, isolated PR each.
5. **D24/25 — Tests + a11y.** Playwright happy-path in EN/SI/TA; Vitest for the existing autosave debounce + sendBeacon flush; a11y audit (heading order, focus management, SR announcement) on the review screen.

## Original v2 list (kept for reference)

## 🔴 Critical — abuse / auth

1. **No rate limit on `startResponse` / `saveAnswers` / `completeResponse`.** All three use `supabaseAdmin` from anonymous callers. Add a per-IP token-bucket (in-memory Map keyed by `cf-connecting-ip`, e.g. 30 starts / 10 min, 120 saves / min). Reject with `429`.
2. **No bot challenge on `startResponse`.** Add Cloudflare Turnstile (Worker-friendly, free). Render the widget on the consent screen; verify the token server-side before insert.
3. **Resume token never rotates.** On `completeResponse`, generate a new token and null the old one so a leaked URL can't reopen a finished survey.
4. **Admin login has no lockout.** Add a per-email/IP failure counter (same in-memory store) — 5 fails / 15 min → temporary block, surface a generic error.
5. **Verify Supabase Auth has "Confirm email" ON.** Document the setting in `db/README.md` and remove any optimistic "Account created" toast that masks unverified state.

## 🟠 High — respondent UX

6. **Save-on-Next blocks navigation.** Switch `SurveyRunner` to optimistic local state + fire-and-forget save; surface failures via toast + retry queue. Extract into a `useAutoSave` hook.
7. **Auto-save runs every 10s regardless of changes; no flush on tab hide.** Replace with debounce-on-change (1.5s) + `pagehide`/`visibilitychange` flush via `navigator.sendBeacon`.
8. **Resume URL exposed in sticky bar.** Hide raw token behind an explicit "Get my resume link" button with a "keep this private" warning.
9. **Per-type validation missing.** `Question` types `email`, `tel`, `number-range` only check `required`. Add per-type validation in `Field`/`isAnswered` with localized error copy.
10. **`showIf` only supports equality.** Extend to `{ op: "eq" | "neq" | "in" | "answered", value? }`; keep legacy shape working.
11. **Cursor tracked by `idx`, not question id.** When visibility shifts, the cursor jumps. Track current question by `id` and recompute idx from visible list.
12. **No pre-submit review screen.** Add a compact summary step before `contact` so respondents can see what they're sending.

## 🟡 Medium — admin dashboard

13. **`getStats` / `listResponses` row caps (2000 / 500) with no pagination.** Add a `survey_stats` SQL view for aggregates and cursor pagination on `listResponses`.
14. **CSV export still buffers full string in Worker memory.** Port the CSV pipeline to the same streaming pattern XLSX already uses (`/api/admin/export.csv?slug=…` returning `text/csv`, admin-cookie check, dedup + CRC32 already proven in the XLSX path).
15. **Daily series is gappy.** Zero-fill missing days client-side or via SQL `generate_series`.
16. **Survey tab labels ignore admin language.** Replace `SURVEY_LIST.map(s => s.title.en)` with `pickText`.
17. **Section-completion view missing.** `sectionBreakdown` already exists in `survey-logic.ts` — wire it into the dashboard.
18. **Admin "forgot password" flow absent.** Add the standard reset link from the existing `/reset-password` route.

## 🟢 Polish & DX

19. **`src/routes/admin.tsx` is 3,866 lines.** Split into per-feature modules under `src/components/admin/` (ExportsPanel, StatsPanel, ResponseList, AuthBootstrap). Pure mechanical refactor, no behavior change.
20. **`src/components/SurveyRunner.tsx` is 1,278 lines.** Extract `useAutoSave`, `useVisibilityFlush`, `useResumeToken` so the JSX shrinks and #6/#7 become small diffs.
21. **`src/lib/admin.functions.ts` is 1,974 lines.** Group by domain: `admin.auth.functions.ts`, `admin.stats.functions.ts`, `admin.exports.functions.ts`.
22. **`__root.tsx` lacks `onAuthStateChange` → `router.invalidate()`.** Stale admin stats persist after sign-out until manual reload.
23. **`Question.help` rendered without sanitization.** Fine for static content today; if survey JSON ever loads dynamically, render via plain text or sanitize.
24. **Tests:** add Playwright happy-path covering phase-1 in EN/SI/TA. Unit tests for new `useAutoSave` debounce + sendBeacon flush behavior.
25. **A11y pass on the new pre-submit review screen** — heading order, focus management on step entry, screen-reader announcement of summary count via `<QuestionCount>`.
26. **`db/schema.sql` drift.** Either regenerate from `supabase db diff` or add a clear note that live RLS lives in migrations.

## Original suggested order

```text
Sprint A (security)        : 1, 2, 3, 4, 5
Sprint B (respondent UX)   : 6, 7, 8, 11, 12 (then 9, 10)
Sprint C (admin)           : 17, 13, 14, 15, 16, 18
Sprint D (refactor + DX)   : 19, 20, 21, 22, 24, 25, 23, 26
```

## Notes

- Items #2 (payload size cap), #3 in v1 (admin bootstrap via env email), and the "block writes when completed" guard are already implemented in `src/lib/responses.functions.ts` and `src/lib/admin.functions.ts` — confirmed during this audit.
- Every shipped change must add a dated entry to `Changelog.md` per project rule.
- Use `<QuestionCount>` / `<QuestionPosition>` for any new question-count copy (SI/TA noun-number ordering).
- Refer to the configured backend in user-facing copy, and avoid leaking provider implementation details.
