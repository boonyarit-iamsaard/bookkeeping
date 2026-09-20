# 13: Delete the legacy app and rewrite policies

Read `../worker-brief.md` first.

**What to build:** The repository has one web client and one backend.
`apps/legacy-web` is gone with its Better Auth mount, its Next.js-only
environment and tooling, and its CI steps; the project documents describe
the SPA client and its browser-test policy instead of the temporary Next.js
adapter.

**Blocked by:** 12: Add the PWA baseline

**Status:** ready-for-agent

**Pattern to copy:** none; this is deletion and documentation. Follow the
list below exactly and do not clean up anything it does not name.

**Out of scope:** any change to the new client's behaviour; refactoring
shared packages "now that Next.js is gone"; renaming `apps/web`; switching to
database migrations; touching `DESIGN.md`.

- [ ] `apps/legacy-web` is deleted; root scripts `dev:legacy-web` and `start:legacy-web`, the Turborepo `.next` outputs, and the CI steps for the legacy env file, Playwright install, and suite are removed.
- [ ] The Next.js Better Auth mount and any `@bookkeeping/auth` code that existed only for it are removed; the server's mount is unchanged and its gateway tests still pass.
- [ ] `@t3-oss/env-nextjs`, `next`, and every dependency no remaining workspace imports are removed from the lockfile (`pnpm install` reports no leftovers).
- [ ] `docs/research/dotenvx-turborepo-nextjs.md` is deleted if nothing references it, otherwise left with a one-line note that Next.js is gone.
- [ ] Root `CLAUDE.md`: the top Next.js block and the "Browser test execution policy" section are replaced with a policy for the SPA suite: run the relevant unit, integration, and contract tests by default; run one focused SPA spec on one project when a change touches the browser boundary; full three-project matrix only on explicit request, at a migration checkpoint, or in CI; local resource limits unchanged.
- [ ] `docs/api-parity.md` "What this does not close" no longer lists the SPA migration and states that the Next.js adapter is removed; `docs/code-conventions.md` no longer refers to Next.js routing or Server Actions where it describes the current layout.
- [ ] `docs/adr/0006-vite-tanstack-router-spa-client.md` gains a short "Outcome" note with the completion date.
- [ ] `pnpm run ci` is green and `pnpm run ci:e2e` passes the full three-project matrix once, run on its own (this ticket is the final parity gate).

**Verify:** `pnpm run ci`; then `pnpm run ci:e2e` alone.
