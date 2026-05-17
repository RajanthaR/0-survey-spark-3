# Troubleshooting

## Bun is not on PATH

This repository uses Bun as the package manager and keeps `bun.lock` as the
only lockfile. Install Bun, then reopen the shell:

```bash
curl -fsSL https://bun.sh/install | bash
bun --version
```

If Bun is temporarily unavailable but `node_modules` already exists, many local
checks can still run through the package binary scripts:

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
node node_modules/prettier/bin/prettier.cjs --check .
```

## Rollup native binary fails on macOS

If Vitest or Vite fails while loading `@rollup/rollup-darwin-*`, refresh the
install with the primary package manager:

```bash
rm -rf node_modules
bun install --frozen-lockfile
```

The failure can also appear when a native optional dependency was restored from
another machine or package manager cache and macOS rejects its code signature.

## `pnpm audit` reports no lockfile

That is expected here: this project does not maintain `pnpm-lock.yaml`.
Security and dependency checks should use Bun-compatible tooling against
`bun.lock`; do not add a second package-manager lockfile.

## Node fallback path

CI and local tooling are pinned to Node 24.15.0. If a shell has an unexpected
Node first on PATH, use the pinned runtime directly through `nvm`:

```bash
nvm install 24.15.0
nvm use 24.15.0
node --version
```

In Codex-like shells, Node may live outside `nvm`; `which node` shows the exact
binary that will run the fallback commands above.
