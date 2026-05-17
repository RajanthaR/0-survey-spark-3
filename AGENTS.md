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
- If the Codex app bundled Node rejects Rollup's native package on macOS, run build/test commands with the local NVM Node first on `PATH`.

## Formatting And Generated Files

- Audit artifacts under `audits/`, `Codex-audits/`, and `Plans/Unified-Audit-Plan-2026-05-17/` are intentionally excluded from formatter churn.
- Generated files such as `src/routeTree.gen.ts` and `src/integrations/supabase/types.ts` are ignored by ESLint/Prettier policy unless the generator itself changes.
- Keep `guardrails.yml` and `csv-export-shape.yml` workflows intact when editing CI.

## Server Boundaries

- TanStack Start route modules are client-imported. Do not statically import `*.server.*` modules from files that can enter the client graph.
- Put testable server-only implementations in `*.impl.server.ts` or `*.shared.server.ts`, and import them inside `createServerFn().handler(...)`.
- Keep client-facing files limited to RPC wrappers, types, schemas, and browser-safe code.

## Verification Notes

- Run focused tests near the changed behavior, then the strict tooling gate.
- Preview smoke should run against `BASE_URL=http://127.0.0.1:4173 bun run smoke` after a successful build and preview start.
- `src/lib/__tests__/codebook-xlsx.test.ts` has shown local Vitest hangs in this environment; treat that as an environment-specific runner issue unless it reproduces in CI.
