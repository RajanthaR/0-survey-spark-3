# P3 — Presentation Lane (`/about/present`)

## Goal

A keyboard-driven, fullscreen-capable slideshow over hand-picked sections from the other three lanes. The PhD candidate connects a laptop to a projector, opens `/about/present`, presses `F` to fullscreen, then `→` to advance through slides. Each slide is one big-type idea or one diagram, not a wall of text. The whole flow exists so she can present her project's status — research and engineering — without juggling browser tabs or a separate slide deck.

Done means: one keystroke takes her into a presentation that walks supervisors through study design, current numbers, and system overview, in that order.

## Why now

- After the content lanes (P1 / P2 / P3 / `02` / `03` / `04`) settle, the presentation lane is mostly composition work: import existing components, drop them into a slide harness.
- Validates the visual quality of the other lanes — anything that doesn't look right blown up to 1920×1080 is honest feedback for the source lane.

## Sources

- `src/about/copy/study.ts` (P1)
- `src/about/components/research/*` (P2)
- `src/about/diagrams/*.mmd` and `src/about/components/MermaidBlock.tsx` (P0 + P3)
- `framer-motion` (already in deps) for slide transitions.

## Slide deck composition

Slides are tracked in a single source file `src/about/content/present/deck.tsx` exporting an ordered `SLIDES` array. Each slide is `{ id: string; kind: 'title' | 'text' | 'diagram' | 'component'; props: ...; speakerHint?: string }`. Authoring slides means editing one file. Reordering = move array entries.

Initial deck (the candidate iterates):

1. **Title** — Study title, candidate, institution, date.
2. **Why** — One sentence: "Why eco-industrial parks for Sri Lanka."
3. **Research question** — One sentence, big type.
4. **Phase 1 instrument** — `<PhaseTimeline phases={['phase-1']} />` rendered large.
5. **Phase 3 instrument** — Same component, `phase-3`.
6. **Participant pathway** — `<SampleFlowDiagram />` from P2.
7. **Where we are now** — `<LiveResponseCounts />` from P2, with bigger typography overrides.
8. **System overview** — `architecture-overview.mmd` via `<MermaidBlock>`.
9. **Survey response write path** — `survey-write-path.mmd`.
10. **i18n pipeline** — `i18n-pipeline.mmd`.
11. **Audit posture** — `<AuditScoreboard>` from P3.
12. **What's next** — Milestones (next 3 only), pulled from `milestones.json`.
13. **Closing** — Contact + thanks.

13 slides is a plausible 15-minute presentation. Trim or expand to match.

## Sessions

### Session 4.1 — Slide harness (S, ~1.5h)

```text
Goal: A `<SlideDeck slides={SLIDES} />` component that handles navigation, transitions, fullscreen, and progress.

Pre-work:
- src/components/SurveyRunner.tsx (only for the keyboard-navigation patterns; do not import)
- framer-motion docs.

Implementation:

1. `src/about/components/present/SlideDeck.tsx`:
   - State: current index (URL hash `#slide-N` for shareability), fullscreen on/off.
   - Keyboard: `→` / `Space` → next, `←` → prev, `Home` → first, `End` → last, `F` → toggle fullscreen, `?` → toggle help overlay, `Esc` → exit fullscreen (browser handles this for `Esc`).
   - Transitions: framer-motion `<AnimatePresence mode="wait">`; `x: 100 → 0 → -100`, `opacity 0 → 1 → 0`, 250ms ease. Honour `prefers-reduced-motion`: snap-cut on transition when set.
   - Progress bar pinned to bottom (`current / total` + filled bar).
   - Bottom-right hint chip: "?" tells the user the keyboard shortcuts.
2. Help overlay (`?`) lists shortcuts; clicking outside dismisses.
3. Fullscreen via the Fullscreen API; fall back to a CSS-fullscreen-emulation class if denied (some embedded browsers).
4. Unit-test the navigation reducer (index advance/reverse, bounds clamp, URL hash sync).

Verification:
- bun run typecheck && bun run lint && bun run test
- Manually: open `/about/present` (with a stub deck), confirm all keyboard shortcuts work, transitions are smooth, fullscreen + reduced-motion behave.
```

### Session 4.2 — Slide kinds (S, ~1h)

```text
Goal: Four render kinds — title, text, diagram, component — with consistent typography sized for projection.

Implementation:

1. `src/about/components/present/slides/TitleSlide.tsx` — centered title + subtitle, very large type (`text-7xl` desktop, scales down on smaller).
2. `src/about/components/present/slides/TextSlide.tsx` — single big sentence, `text-5xl`, centered. Optional eyebrow label.
3. `src/about/components/present/slides/DiagramSlide.tsx` — wraps `<MermaidBlock>` with a slide title above. The Mermaid SVG fills 80% of the slide height.
4. `src/about/components/present/slides/ComponentSlide.tsx` — generic wrapper that renders any provided React node inside a slide title + padded canvas. Use this for `<LiveResponseCounts />` etc.
5. Add a wrapper that injects a `presentation` CSS class on `<body>` while a slide is showing, so components that need bigger typography in presentation context can opt in via `body.presentation .stat-tile-number { @apply text-6xl; }` etc.

Verification:
- Each slide kind renders correctly in normal and fullscreen modes at 1920×1080. Spot-check at 1280×800 (typical laptop).
```

### Session 4.3 — Author the initial deck + page (S, ~1h)

```text
Goal: `src/about/content/present/deck.tsx` exists with the 13-slide initial deck, and `/about/present` renders it.

Implementation:

1. Author `deck.tsx` per the slide composition above.
2. Replace the placeholder in `src/routes/about.present.tsx` with `<SlideDeck slides={SLIDES} />`.
3. Hide the `AboutLayout` sidebar + breadcrumbs when on the present route (the `AboutLayout` component reads a route-level flag and degrades to a minimal chrome). Reason: every pixel matters on a projector.
4. Add a small "Exit presentation" button in the top-right that navigates to `/about` — visible only when NOT in fullscreen.
5. Pre-warm the lazy Mermaid chunk on slide N when slide N+1 is a diagram, so transitions are instant. (Use a `useEffect` with `import('mermaid')` keyed off `currentIndex`.)

Verification:
- bun run typecheck && bun run lint && bun run test && bun run build
- Manually: open `/about/present`, hit `F`, advance through all 13 slides, confirm no jank on diagram transitions.
- On reduced-motion, confirm transitions snap-cut.
- Project the page on an external display to validate typography sizes.
```

## Done criteria

- [ ] `SlideDeck` handles keyboard nav, fullscreen, progress bar, help overlay.
- [ ] Reduced-motion honoured.
- [ ] Four slide kinds render cleanly at 1920×1080 and 1280×800.
- [ ] Initial 13-slide `deck.tsx` exists; candidate can edit one file to reorder/rewrite.
- [ ] `/about/present` lazy-loads its own chunk (no impact on the rest of `/about/*` bundle).
- [ ] AboutLayout chrome is minimised on present route.
- [ ] "Exit presentation" button visible when not in fullscreen.

## Risks

- **Diagram transitions can stutter** if Mermaid re-renders during the framer-motion slide-in. Mitigation: render the diagram into the DOM ahead of time (hidden via `opacity-0`), then animate. Pre-warm strategy in session 4.3 step 5.
- **Fullscreen API requires a user gesture.** The `F` key counts as a gesture; auto-fullscreen on page load does not. Don't try to auto-enter fullscreen.
- **Live response counts may render `<10` rounded values during a live presentation.** That's correct behaviour from P2 but could surprise her on stage. Mitigation: the slide includes both the rounded count and a "Anonymity-protected at N<10" footnote so she can explain it before being asked.
- **Slide deck is committed code, not a UI editor.** Reordering or rewording slides requires a commit. That's a deliberate tradeoff — it keeps the deck under version control and reviewable, but means she can't tweak a slide 5 minutes before a meeting without dev tooling. If that becomes painful, a JSON-driven slide source is a small follow-up; not v1.
