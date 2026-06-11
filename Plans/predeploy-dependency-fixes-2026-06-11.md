# Pre-deploy dependency fixes — 2026-06-11

Codex task prompt for the two deploy-blocking findings (F-01, F-02) from
[audits/production-readiness_fable.md](../audits/production-readiness_fable.md).
Prerequisite (already done): the codebook-xlsx OOXML work is committed (`20192c8`).

---

**Task: Fix two pre-deploy dependency vulnerabilities in survey-spark-3**

Repo: `survey-spark-3` (TanStack Start app, Bun 1.3.14 package manager, Node 24
runtime). Run all commands with `bun`. Do not upgrade anything beyond what's
specified.

**1. Update `@tanstack/react-start` so the locked server core is ≥ 1.167.30**

The lockfile pins `@tanstack/start-server-core@1.167.22`, which is vulnerable to
GHSA-9m65-766c-r333 (inbound server-function request deserialization can invoke
a sibling client-referenced server function). The fix landed in 1.167.30. The
`package.json` ranges (`@tanstack/react-start: ^1.167.50`,
`@tanstack/react-router: ^1.168.25`, `@tanstack/router-plugin: ^1.167.28`)
already permit it — only `bun.lock` is behind.

- Run `bun update @tanstack/react-start @tanstack/react-router @tanstack/router-plugin`
  (patch/minor within existing ranges only — do not jump major versions).
- Verify with `grep '"@tanstack/start-server-core@' bun.lock` that the locked
  version is ≥ 1.167.30.
- This app's entire write path is TanStack server functions, so regression-check
  that surface: run `bun run typecheck`, `bun run lint`, `bun run test`, and
  `bun run build`, and confirm `bun run smoke` (SSR smoke script) still passes
  against a built server.

**2. Resolve the `xlsx@0.18.5` HIGH advisories (GHSA-4r6h-8v6p-xvw6 prototype
pollution, GHSA-5pgg-2g8v-p4x9 ReDoS)**

The npm registry build of SheetJS is frozen at 0.18.5; patched builds (≥ 0.19.3)
ship only from SheetJS's own CDN. Replace the dependency with the patched
tarball:

- In `package.json`, change `"xlsx": "^0.18.5"` to the latest 0.20.x tarball
  from `https://cdn.sheetjs.com/` (e.g.
  `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` — check the
  CDN for the current latest 0.20.x and use that).
- Run `bun install` to update the lockfile.
- Important context: `src/lib/codebook-xlsx.ts` post-processes the written
  workbook by unzipping and patching raw OOXML (frozen header pane + bold
  header styles via `fflate`), because the community 0.18.5 build dropped
  `!freeze` and `cell.s`. Verify this still behaves correctly on 0.20.x — the
  tests in `src/lib/__tests__/codebook-xlsx.test.ts` assert on the raw sheet
  XML and `xl/styles.xml`. If 0.20.x changes the emitted XML shape (e.g.
  styles.xml structure, sheetViews already present), adapt the patch code in
  `persistHeaderFormatting` minimally so the tests' contracts (frozen row 1,
  bold header cells, unstyled data rows) still hold. Run that test file under
  the node environment as it's configured
  (`bunx vitest run src/lib/__tests__/codebook-xlsx.test.ts`).
- Also run the full suite (`bun run test`) since other export tests
  (`csv-export-shape`, admin exports) touch xlsx.
- If the CDN tarball approach fails for any reason (install or runtime), STOP
  and report back instead of downgrading or keeping 0.18.5 silently.

**Acceptance criteria**

- `bun audit` no longer reports the `@tanstack/start-server-core` advisory or
  the two `xlsx` HIGH advisories (the dev-only `brace-expansion` moderate may
  remain).
- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, and
  `bun run smoke` all pass.
- Note: `src/about/components/__tests__/StudyLaneContent.test.tsx` has one
  known timeout flake under CPU load — if only that test fails, rerun it in
  isolation before treating it as a regression.
- Commit as two separate commits (one per dependency) with messages explaining
  the advisory IDs being fixed.
