# 04: Vitest cache race fails `pnpm run ci` at startup

Read `README.md#checks` first.

**What to build:** `pnpm run ci` never fails because two Vitest runs touch
the same cache directory at once.

**Blocked by:** None

**Status:** needs-triage

**Notes:** Not yet diagnosed. Start with `/diagnosing-bugs`; it needs a
command that reproduces the failure before any fix.

- [ ] Find which runs share `node_modules/.vitest-cache` at the repository root, and why it is emptied while another run reads it.
- [ ] A fix that keeps Turborepo's task parallelism, for example a separate cache directory per Vitest run.
- [ ] Repeated `pnpm run ci` runs show no `ENOTEMPTY` startup error.

## Comments

### 2026-10-23: seen once

The first `pnpm run ci` on `feat/production-backups` failed in
`//#test:scripts` before any test ran:

```text
Startup Error
Error: ENOTEMPTY: directory not empty, rmdir '<repo>/node_modules/.vitest-cache'
```

`pnpm run test:scripts` on its own then passed (5 files, 32 tests), and two
later full `pnpm run ci` runs passed. Turborepo runs `test` (every workspace)
and `//#test:scripts` (the root `vitest.config.mts`) in one `turbo run`, in
parallel. Vitest is 5.0.5. Each workspace has its own `node_modules/.vite`,
but `.vitest-cache` exists only at the root, so something other than the
root run may be writing there. That part is unconfirmed. Not seen in GitHub
Actions so far.
