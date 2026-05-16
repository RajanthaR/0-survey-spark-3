I'll save this plan to `docs/plans/option-visuals.md` and execute it in phases.

## Goal

Let any `single_choice`, `multi_choice`, `yes_no`, `likert_5`, or month/sector picker question carry a visual per option. Per-question rule: **all options carry a visual or none do** — enforced in types and at runtime. Style is hybrid (lucide icon by default, AI-generated illustration where richer meaning helps). Assets ship in-repo under `src/assets/options/`. First shipped survey is `phase-1`.

## Phases

### Phase 1 — Schema + renderer foundation (no art yet)

- Extend `Option` in `src/surveys/types.ts` with an optional `visual` field:
  - `{ kind: "icon"; name: LucideIconName; tone?: "default" | "positive" | "negative" }`
  - `{ kind: "image"; src: string; alt?: LocalizedString }`
- Add a dev-only invariant in `src/surveys/index.ts` (or a new `validate.ts`) that asserts every `options[]` is either fully visual'd or fully not. Throw at module load in dev; log + degrade in prod.
- Update `QuestionView` `Field` renderer:
  - `single_choice` / `multi_choice` / `yes_no`: render the visual in a fixed 40×40 leading slot before the label; keep current spacing/active states.
  - `likert_5`: when faces are configured, render five face icons above the numerals (numeral stays for accessibility).
  - Layout breakpoint: ≥3 options with images → switch to a 2-col grid on `sm:` so cards stay readable; ≤2 options stay stacked.
- A11y: visuals are decorative when they merely echo the label (`aria-hidden`); when an `alt` is supplied, render `<img alt>` and skip `aria-hidden`. Focus ring and keyboard nav unchanged.
- Add a small `<OptionVisual>` component so the renderer stays tidy.

### Phase 2 — Icon vocabulary (lucide pass)

- Build `src/surveys/visuals/icons.ts` exporting a curated allowlist (~40 icons) typed against lucide names — keeps tree-shaking honest and stops drift.
- Wire icons for the easy wins in phase-1:
  - `YES_NO_OPTIONS` → `ThumbsUp` / `ThumbsDown` (tone positive/negative)
  - `LIKERT_5` → `Frown`, `Meh`, `CircleDot`, `Smile`, `Laugh` (faces)
  - `DOC_OPTIONS` → `FileText`, `Map`, `BookOpen`, `BarChart3`, `Leaf`, `ClipboardCheck`, `GraduationCap`, `Network`, `Wallet`, `Gauge`
  - `DOC_SHARING_OPTIONS` → `CheckCheck`, `Check`, `Lock`, `Mail`
  - `MONTHS_12` → numeric-month glyphs via lucide `Calendar` + month label (no per-month art needed)
- Snapshot test: render every phase-1 option-bearing question and assert the visual rule holds.

### Phase 3 — Illustration pipeline (AI gen, one-off)

- Add `scripts/generate-option-illustrations.ts` — a dev-only script (not shipped) that:
  - Reads a manifest `src/surveys/visuals/illustrations.manifest.ts` (tuples of `{ slug, prompt, size }`).
  - Calls the configured image-generation endpoint with a fixed style prompt ("flat vector illustration, 2-tone, transparent background, isometric, soft shadow, subject centered, ~512px").
  - Writes `src/assets/options/<slug>.webp` (converted via `sharp`-free pipeline — use `nix run nixpkgs#libwebp` cwebp on the PNG output).
  - Idempotent: skips slugs whose file already exists unless `--force`.
- Use it for the questions where a glyph reads poorly: stakeholder/sector pickers, project-type lists, and any phase-1 question whose options name physical things (crops, infrastructure, ecosystems).
- Each generated `webp` is statically imported in the question definition: `import farming from "@/assets/options/sector-farming.webp"` → `visual: { kind: "image", src: farming, alt: { en: "..." , si: "...", ta: "..." } }`.

### Phase 4 — Phase-1 survey rollout

- For every option-bearing question in `src/surveys/phase-1.ts`, decide icon vs illustration vs none, and add `visual` consistently to all options or none.
- Verify the dev invariant passes; run vitest; visually QA in preview at 534px (current viewport) and ≥768px.
- Update `Changelog.md`.

### Phase 5 — Phase-3 survey + admin/codebook surfacing — ✅ shipped

- Phase-3 rollout complete: every option-bearing question has icons (sectors, org type, energy/CE/IS questions, signal-0..3 magnitude buckets, etc.). Two icons added: `box`, `truck`.
- Admin response viewer renders `<ResponseVisualSummary>` per row in the respondent's recorded language.
- Document the contributor workflow in `docs/option-visuals.md`: how to pick an icon, how to add an illustration, how to run the gen script.

## Technical details

- **No DB changes.** `responses.answers` keeps storing string values; visuals are presentation only, looked up from the survey definition by `option.value`.
- **Bundle budget.** Lucide icons cost ~0 (already in deps, tree-shaken). Each illustration target ≤25 KB webp; cap total illustration count at ~40 across both surveys (~1 MB max) — anything larger goes back to icon.
- **Type safety.** `LucideIconName` is `keyof typeof import("lucide-react")` narrowed via the allowlist so a typo fails typecheck.
- **i18n.** `alt` is a `LocalizedString` and resolved with `pickText(alt, lang)` like every other label.
- **Tests.** Add `src/surveys/__tests__/visuals.invariant.test.ts` enforcing the all-or-none rule for every survey in `src/surveys/index.ts`. Update existing snapshot/render tests if they exist.
- **Files touched in phase 1–4:** `src/surveys/types.ts`, `src/surveys/index.ts` (or new `validate.ts`), `src/surveys/visuals/icons.ts`, `src/surveys/visuals/illustrations.manifest.ts`, `src/components/survey/QuestionView.tsx`, new `src/components/survey/OptionVisual.tsx`, `src/surveys/phase-1.ts`, `src/assets/options/*.webp`, `scripts/generate-option-illustrations.ts`, `Changelog.md`, plan doc at `docs/plans/option-visuals.md`.

After you approve, I'll save the markdown plan and start with Phase 1 (schema + renderer) so we can see one phase-1 question wired before bulk-generating any art.
