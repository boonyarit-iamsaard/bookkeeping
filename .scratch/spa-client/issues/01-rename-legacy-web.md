# 01: Rename the Next.js app to legacy-web

Read `../worker-brief.md` first.

**What to build:** The Next.js application lives at `apps/legacy-web` as
`@bookkeeping/legacy-web`, and every script, filter, workflow, and runner
that pointed at the old name points at the new one. Nothing about the app's
behaviour changes; the existing browser suite still passes against it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Pattern to copy:** none; this is a mechanical rename. Use `git mv` for the
directory so history follows.

**Out of scope:** any code change inside the app; touching `apps/server` or
`packages/*`; dependency changes; creating the new client (ticket 02).

- [ ] The directory is `apps/legacy-web` and its package name is `@bookkeeping/legacy-web`.
- [ ] Root scripts `dev:web` and `start:web` are renamed `dev:legacy-web` and `start:legacy-web` and filter the renamed package; `dev:web` / `start:web` are left absent for ticket 02 to claim.
- [ ] The CI workflow copies the CI env example from, and installs Playwright browsers for, the renamed package.
- [ ] The Turborepo `build` outputs still cover the Next.js output directory.
- [ ] `pnpm run ci` is green.
- [ ] The legacy browser suite passes on its `phone` project run alone (this ticket only: `pnpm --filter @bookkeeping/legacy-web test:e2e -- --project=phone`).

**Verify:** `pnpm run ci`, then the legacy phone project as above. Do not run
the desktop project.
