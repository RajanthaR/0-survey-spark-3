# P1 — Study Lane (`/about/study`)

## Goal

A trilingual (EN / SI / TA) one-page "about this research" surface for survey respondents and casually-curious visitors. Explains what the study is, who is running it, what data is collected, how privacy is protected, and where to ask questions. No internals. Reads at a 9th-grade level in all three languages.

## Why now

- Cheapest lane to build — no Markdown loader, no Mermaid, no live data, no audit parsing. Single React component + dictionary entries.
- Unblocks the global header link being useful for the largest audience.
- Establishes the i18n copy pattern that the rest of the project already uses (`pickText` + `UI` dict), so reviewers can be sure this lane fits the existing architecture before the bigger lanes land.

## Sources

- `src/lib/i18n.ts` — the `UI` dict and `pickText(text, lang)` pattern. This lane extends it with a new `ABOUT_STUDY` dict.
- `src/components/LanguageToggle.tsx` — language switcher already used on `/` and `/s/$slug`. Reuse on this page.
- `src/surveys/consent.ts` — privacy/consent text is the source of truth. Do not duplicate; link to it via in-app text.
- `src/routes/index.tsx` — visual reference: gradient hero, card stack, max-w-2xl layout.
- `README.md` — for university/affiliation framing.
- `Codex-audits/09-multilanguage-i18n-audit.md` — for known i18n gotchas (Sinhala font fallback handled via `noto-fonts.ts`).

## Content plan

Single page, single column, max-w-2xl, with these sections in order:

1. **Hero**
   - Title: "About this research" / "මෙම පර්යේෂණය ගැන" / "இந்த ஆராய்ச்சி பற்றி"
   - One-sentence subtitle naming the affiliation (University of Sri Jayewardenepura per README).
2. **What this study is**
   - 2–3 sentences. Eco-Industrial Park research in Sri Lanka. Phase 1 (Industry Profile) + Phase 3 (Stakeholder).
3. **Who can take part**
   - 2 sentences. Industries / stakeholders in the relevant sectors. Voluntary.
4. **What you'll be asked**
   - 2 sentences. Time estimate (~12 min per phase per `phase-1.ts`).
5. **Privacy**
   - 3 sentences. Anonymous responses, stored in Sri Lanka-jurisdiction Supabase (factually accurate? confirm region — if Supabase project is in another region, state truthfully). Resume tokens expire (per recent commit "Align resume token TTL to 30 days to match DB expiry"). Link to consent text.
6. **Contact**
   - Name + email per README (`Rajantha R Ambegala`, `rajantha.rc@gmail.com`).
7. **Footer links**
   - "Take the survey" → `/`
   - "For researchers" → `/about/research` (EN-only label noted)
   - "For engineers" → `/about/engineering` (EN-only label noted)

The "For researchers" and "For engineers" links use small muted styling and an English label even in SI/TA modes, with a brief note "(English only)" — these lanes are not translated and pretending otherwise would mis-set expectations.

## Sessions

### Session 1.1 — Author trilingual copy + dictionary entries (S, ~1h)

```text
Goal: Add a complete trilingual content dictionary for the study lane.

Pre-work (read-only):
- src/lib/i18n.ts (the UI dict shape)
- src/surveys/consent.ts (for privacy phrasing alignment)
- src/surveys/phase-1.ts (for phase descriptions to keep terminology consistent)
- README.md (for affiliation + contact)

Implementation:

1. In `src/about/copy/study.ts`, export a typed dictionary `ABOUT_STUDY` mirroring the `UI` dict shape: each key is `{ en, si, ta }`. Keys: `pageTitle`, `pageSubtitle`, `whatItIsHeading`, `whatItIsBody`, `eligibilityHeading`, `eligibilityBody`, `tasksHeading`, `tasksBody`, `privacyHeading`, `privacyBody`, `privacyConsentLink`, `contactHeading`, `contactName`, `contactEmail`, `footerTakeSurvey`, `footerForResearchers`, `footerForEngineers`, `footerEnglishOnlyNote`.
2. Sinhala translations: hand-author or commission. DO NOT machine-translate. If the PhD candidate is the author, she should review every Sinhala string before merge. The plan-author flags this in the PR description.
3. Tamil translations: same — hand-author or commission, reviewer attribution recorded in a code comment per the existing `phase-1.ts` precedent ("EN drafted from the Sinhala source · SI verbatim from source · Tamil strings populated; independent reviewer attribution pending").
4. Add a unit test `src/about/copy/__tests__/study.test.ts` asserting every key has all three languages populated and no string is empty / equal to the English string in a non-English slot.
```

### Session 1.2 — Build the page (S, ~1h)

```text
Goal: Render the study lane at `/about/study` using the dictionary from session 1.1.

Pre-work (read-only):
- src/routes/index.tsx (visual reference)
- src/components/LanguageToggle.tsx
- src/about/layout/AboutLayout.tsx (from P0)
- src/about/copy/study.ts (from session 1.1)

Implementation:

1. Replace the placeholder in `src/routes/about.study.tsx` with the full layout.
2. Use the gradient-eco hero treatment from `src/routes/index.tsx` for visual continuity.
3. Each section uses `pickText(ABOUT_STUDY.key, lang)`.
4. Footer links: `<Link to="/" />` for survey CTA; `<Link to="/about/research" />` and `<Link to="/about/engineering" />` for the cross-lane links. Append the "(English only)" note inline using `pickText(ABOUT_STUDY.footerEnglishOnlyNote, lang)` so the note itself is trilingual.
5. Set page `head()` metadata with trilingual title via the `useLang()` hook — server-render the language detected by the existing language detection pipeline.
6. Add `useAboutSection("study", pickText(ABOUT_STUDY.pageTitle, lang))` to surface the right breadcrumb.

Verification:
- bun run typecheck && bun run lint -- --max-warnings 0 && bun run test
- Manually toggle EN / SI / TA via the `LanguageToggle` and confirm each string renders correctly with the correct Noto font.
- bun run build && bun run size # no regression
- After P4 lands axe coverage: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 bun run test:a11y` includes `/about/study` and passes.
```

## Done criteria

- [ ] `src/about/copy/study.ts` exports a full `ABOUT_STUDY` dictionary with EN / SI / TA strings for every key.
- [ ] Unit test asserts no missing translations and no English fallbacks in SI/TA slots.
- [ ] `/about/study` renders with hero + 6 sections + footer links.
- [ ] LanguageToggle switches all on-page strings; SI/TA strings render in their respective Noto fonts (existing `noto-fonts.ts` machinery handles this — no new fonts).
- [ ] Footer cross-lane links route correctly to `/about/research` and `/about/engineering` (placeholders are fine at this stage).
- [ ] `head()` metadata is localised.
- [ ] All gates green: `typecheck && lint && test && build`.

## Risks

- **Translation quality risk.** Machine-translated Sinhala or Tamil content on a research consent-adjacent page is reputation-damaging. Mitigation: PR description explicitly requests the PhD candidate's sign-off on every non-EN string before merge.
- **Privacy text drift.** If the consent text in `src/surveys/consent.ts` changes after this lane lands, the study lane's privacy paragraph could become out of date. Mitigation: keep the privacy paragraph short and abstract; let users click the in-page link to see the canonical consent text rather than restating it in full.
- **Footer cross-lane links could confuse SI/TA users** who click into an English-only `/about/research` page. Mitigation: the "(English only)" inline note + treating the link label itself as English text in all three modes — both signals are visible before the click.
