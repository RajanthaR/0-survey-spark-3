# Audit 01 — Content

Scope: survey copy, UI strings, marketing/landing text, README, deployment
docs, microcopy in toasts and error states.

## Strengths

- **Surveys mirror their source.** `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/surveys/phase-1.ts:1-32` and `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/surveys/phase-3.ts:1-32` document provenance (Sinhala master, EN derived) and the trilingual `LocalizedString` shape is rigorously typed in `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/surveys/types.ts:44-92`.
- **Consent items are explicit.** `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/surveys/consent.ts:1-148` contains both required and optional consent triples per language.
- **Microcopy supports the long flow.** Encouragement strings at the halfway mark and an inline `errorSummaryTitle` are localised in `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/i18n.tsx:74-78` and `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/i18n.tsx:203-208`.
- **Branded 404 + 500 pages.** `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/__root.tsx:19-74` and `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/error-page.ts:1` keep failure modes on-brand.

## Findings

### C-1 — Stale "TA = TODO" provenance comments _(minor)_

Both survey files claim Tamil is a TODO that "falls back to EN in UI":

```@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/surveys/phase-1.ts:1-8
import { CONSENT_ITEMS } from "./consent";
import { DOC_OPTIONS, DOC_SHARING_OPTIONS, type Survey } from "./types";

/**
 * Phase 1 — Industry Profile.
 * Mirrors `පළමු_අදියර-Industries-Sinhala_Version.md` 1:1.
 * EN drafted from the Sinhala source · SI verbatim from source · TA = TODO (falls back to EN in UI).
 */
```

In reality, every `ta:` key is populated (168 EN ≡ 168 SI ≡ 168 TA in `phase-1.ts`; 195 / 195 / 195 in `phase-3.ts`). Either remove the comment or replace it with a note about who reviewed the Tamil translation and on what date.

### C-2 — Hard-coded localised string inside a component _(real bug)_

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:517` builds the "+N skipped" pill using an inline `lang === "si" ? "..." : ...` switch:

```@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:515-518
className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
>
  +{skippedCount} {lang === "si" ? "මඟ හරින ලදී" : lang === "ta" ? "தவிர்க்கப்பட்டது" : "skipped"}
</motion.span>
```

This is the same anti-pattern the ESLint rule `no-restricted-syntax` and the
`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/__tests__/no-inline-localized-labels.test.ts` guardrail were created to prevent. Move into `UI.skipped` and render with `pickText(UI.skipped, lang)`.

Other inline leaks called out by the failing guardrail test:

- `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/survey/ResponseVisualSummary.tsx:19`
- `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/analytics-report-i18n.ts:40`
- `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/exports-extended.ts:79` (only a comment-doc example, but caught the same way)
- `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/admin.tsx:2468`

### C-3 — Researcher-facing copy mixes "EIP Insight" with researcher branding

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/index.tsx:70-74` exposes a "Researcher login" link directly underneath the public survey list. From a respondent's perspective the bare link is fine, but consider:

- A small visual separator or accordion to keep researcher-only affordances tucked away.
- Localising the "Researcher login" label (it is hard-coded English today).

### C-4 — Landing intro/tagline lengths differ wildly across languages

The English `intro` is two sentences while Sinhala/Tamil are clipped to a single one:

```@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/lib/i18n.tsx:38-42
intro: {
  en: "A short, anonymous research survey by the University of Sri Jayewardenepura. Your input directly informs PhD research on sustainable industrial development across South Asia.",
  si: "ශ්‍රී ජයවර්ධනපුර විශ්වවිද්‍යාලයේ කෙටි, නිර්නාමික පර්යේෂණ සමීක්ෂණයකි.",
  ta: "ஸ்ரீ ஜயவர்தனபுர பல்கலைக்கழகத்தின் சுருக்கமான, அநாமதேய ஆராய்ச்சி கணக்கெடுப்பு.",
},
```

Bring the SI/TA versions up to parity with the English copy — particularly the "informs PhD research on sustainable industrial development" framing, which is the recruitment hook.

### C-5 — Marketing meta on `/` includes EIP-specific keywords; survey routes do not

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/routes/s.$slug.tsx:17-33` falls back to a generic "Anonymous research survey." description. Promote per-survey `subtitle.en` (already on the survey object) into `og:description` and Twitter card. Add `robots: noindex,nofollow` to half-finished response shells if relevant — although since the survey route is only meaningful with a token, this is mostly an SEO polish item.

### C-6 — README + Deployment doc gaps

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/README.md:1-98` and `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/docs/DEPLOYMENT.md:1-46` are accurate but missing:

- A "Quickstart" diagram for the survey → resume → admin → export pipeline.
- A "Local dev without Supabase" section (right now `bun run dev` will throw because `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/integrations/supabase/client.ts:11-19` hard-fails on missing env).
- A note on the static `db/schema.sql` snapshot vs. live migrations (called out in the existing audit plan but never landed).
- A note pointing devs at `Plans/AuditV2-fixes.md` and `Plans/post-audit-plan.md` for in-flight work.
- A statement of which Tamil translator validated the strings.

### C-7 — Toast/error microcopy collapses many failure modes into one

`pickText(UI.errorSave, lang)` is used for save, complete, and continue-with-Turnstile fallback failures (`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:259-264`, `@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/src/components/SurveyRunner.tsx:651`). Differentiating "no connection" vs "already submitted" vs "validation rejected" toasts gives users actionable next steps and reduces support load.

### C-8 — Plans / Changelog files are large but not user-facing

`@/Users/rajantha/Documents/0CODE/GitHub/survey-spark-3/Changelog.md` is 166 KB of internal release notes. Consider:

- Adding a "Release notes summary" section at the top.
- Splitting per-quarter or per-sprint files (`Changelog/2026-Q2.md`).
- Auto-publishing the latest entry to `/docs/release-notes.md` for stakeholders.

## Suggested improvements (Content)

1. Replace the inline `+N skipped` pill literal with a dictionary entry (`UI.skipped`).
2. Audit and remove the other 4 inline SI/TA literals flagged by `no-inline-localized-labels.test.ts`.
3. Update the `phase-1.ts` / `phase-3.ts` doc comments to reflect actual translation status + reviewer.
4. Expand the SI/TA `intro` strings so the recruitment hook is the same across languages.
5. Localise the "Researcher login" CTA on `/`.
6. Add a survey-specific `og:description`/`og:image` per `survey.slug`.
7. Expand `README.md` with the missing sections above + a Tamil reviewer attribution.
8. Differentiate save/complete/Turnstile failure toasts.
9. Trim `Changelog.md` to a per-quarter rotation.
