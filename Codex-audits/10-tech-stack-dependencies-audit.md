# Tech Stack And Dependencies Audit

## Current State

The README and package scripts assume Bun 1.x. The repository contains `bun.lock`, `bunfig.toml`, `package.json`, and a populated `node_modules` tree that appears pnpm-style internally. In this shell, Node is available from the Codex app, pnpm is available, but Bun and npm are not.

## Findings

- `bun` is not on PATH, so `bun run dev`, `bun run test`, `bun run build`, and Playwright webServer startup fail in this environment.
- `npm` is also not available in this shell, while `pnpm` is available at `/Users/rajantha/.local/share/pnpm/pnpm`.
- `pnpm audit --prod` cannot audit because there is no `pnpm-lock.yaml`; the repo uses `bun.lock`.
- Rollup's native optional package is present but macOS rejects the native binary due to code-signing/Team ID issues, blocking Vite and Vitest.
- `pnpm outdated --format list` completed and showed upgrades for TanStack Router/Start, Vite, ESLint, TypeScript, Recharts, Zod, lucide-react, React Day Picker, plugin-react, and type packages.
- Dependencies include many Radix packages. This is common for shadcn-style UI, but periodic dependency pruning is worthwhile.
- React 19 and TanStack Start are modern and may have fast-moving compatibility expectations, so upgrades should be batched and verified.

## Suggested Improvements

- Choose and document one primary package manager for local and CI. If it is Bun, ensure Bun is installed in all dev/test environments.
- Add package-manager preflight instructions and a troubleshooting section for Rollup native optional dependencies.
- Add scripts: `typecheck`, `format:check`, and lockfile-appropriate `audit`.
- If pnpm is supported as a fallback, commit `pnpm-lock.yaml` intentionally and update docs/scripts. Otherwise avoid pnpm audit instructions.
- Batch dependency upgrades by risk: patch/minor TanStack first, tooling next, then major upgrades like Vite 8, ESLint 10, TypeScript 6, Recharts 3, Zod 4.
- Run full lint/typecheck/build/test/e2e after every upgrade batch.
- Add a dependency review cadence for security and bundle impact.

## Priority

- P0: Restore Bun or provide working non-Bun scripts for local verification.
- P0: Repair Rollup native module loading.
- P1: Add explicit dependency/audit policy matching the committed lockfile.
- P2: Upgrade packages in controlled batches.

## Verification

- `bun --version` fails with `zsh:1: command not found: bun`.
- `node --version` reports `v24.14.0` from the Codex app.
- `pnpm --version` reports `10.33.4`.
- `pnpm audit --prod` fails with `ERR_PNPM_AUDIT_NO_LOCKFILE`.
- `pnpm outdated --format list` reports multiple available upgrades.

## Related Files

- `package.json`
- `bun.lock`
- `bunfig.toml`
- `README.md`
- `playwright.config.ts`
- `vite.config.ts`
- `vitest.config.ts`
