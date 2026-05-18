# Repository Guidance

## Tooling

- Use Bun as the package manager. `bun.lock` is the source of truth; do not add `pnpm-lock.yaml`.
- Expected local runtimes are Bun `1.3.14` and Node.js `24.15.0`. `.nvmrc` and `.tool-versions` document the pins.
- Prefer the project scripts:
  - `bun run typecheck`
  - `bun run lint -- --max-warnings 0`
  - `bun run format:check`
  - `bun run test`
  - `bun run build`
- If `bun` is not on `PATH` (fresh Codex shell), prepend `~/.bun/bin` first, e.g. `export PATH="$HOME/.bun/bin:$PATH"`. If Bun is missing entirely, install with `curl -fsSL https://bun.sh/install | bash`; the installer pins itself into `~/.zshrc`.
- If the Codex app bundled Node rejects Rollup's native package on macOS (`ERR_DLOPEN_FAILED` / invalid code signature on `@rollup/rollup-darwin-*`), run build/test commands with the local NVM Node first on `PATH`, e.g. `export PATH="/Users/rajantha/.nvm/versions/node/v24.14.1/bin:$PATH"`. Bun and NVM Node should both be ahead of the bundled Node.

## Formatting And Generated Files

- Audit artifacts under `audits/`, `Codex-audits/`, and `Plans/Unified-Audit-Plan-2026-05-17/` are intentionally excluded from formatter churn.
- Generated files such as `src/routeTree.gen.ts` and `src/integrations/supabase/types.ts` are ignored by ESLint/Prettier policy unless the generator itself changes.
- `lint-staged` (husky pre-commit) prettier-checks `*.{ts,tsx,js,mjs,cjs,json,md,css,html,yml,yaml}` and ESLints `*.{ts,tsx}`. Editing workflow YAML triggers prettier on commit.

## CI Topology

Four workflows under `.github/workflows/`:

- `pr.yml` — runs on PR + push: main. Three parallel jobs: `static` (typecheck + format + lint + service-role grep), `test` (vitest), `build` (vite). Fan-out is for wall-clock; do not collapse them back into one job without measuring.
- `smoke.yml` — runs on push: main only. Builds, starts the preview server, runs `scripts/smoke-ssr.mjs` against the 5 canonical routes. **This is a deploy gate**: a smoke failure on main MUST be reverted before any further pushes. Do not move it onto PRs without a deliberate compute-vs-feedback decision.
- `guardrails.yml` — strict subset of `pr.yml`'s `bun run test`. Runs on PR only. Keep intact.
- `csv-export-shape.yml` — strict subset of `pr.yml`'s `bun run test`. Runs on PR only. Keep intact.

All four workflows declare `concurrency: cancel-in-progress: true` on `${{ github.workflow }}-${{ github.ref }}` and share a `paths-ignore` block for `audits/`, `Codex-audits/`, `Plans/`, `docs/`, `**/*.md`, `LICENSE`, `.gitignore`, `.gitattributes`, `.editorconfig`. Keep that block in sync across all four when editing.

## Server Boundaries

- TanStack Start route modules are client-imported. Do not statically import `*.server.*` modules from files that can enter the client graph.
- Put testable server-only implementations in `*.impl.server.ts` or `*.shared.server.ts`, and import them inside `createServerFn().handler(...)`.
- Keep client-facing files limited to RPC wrappers, types, schemas, and browser-safe code.

## Verification Notes

- Run focused tests near the changed behavior, then the strict tooling gate (`bun run typecheck && bun run lint -- --max-warnings 0 && bun run format:check && bun run test && bun run build`).
- Local preview smoke: `bun run build && bun run preview -- --host 127.0.0.1 --port 4173 &` then `BASE_URL=http://127.0.0.1:4173 bun run smoke`. CI runs this same flow in `smoke.yml` only on push: main, so PRs that touch `src/start.ts`, `src/lib/security-headers.server.ts`, `src/routes/__root.tsx`, or anything else affecting SSR / CSP should be smoked locally before merging.
- `src/lib/__tests__/codebook-xlsx.test.ts` has shown local Vitest hangs in this environment; treat that as an environment-specific runner issue unless it reproduces in CI. Use `bun run test -- --exclude '**/codebook-xlsx.test.ts'` to bypass when running the full suite locally.
