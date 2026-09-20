# 01: Rename the Next.js app to legacy-web

Read `../worker-brief.md` first.

**What to build:** The Next.js application lives at `apps/legacy-web` as
`@bookkeeping/legacy-web`, and every script, filter, workflow, and runner
that pointed at the old name points at the new one. Nothing about the app's
behaviour changes; the existing browser suite still passes against it.

**Blocked by:** None (can start immediately)

**Status:** done

**Pattern to copy:** none; this is a mechanical rename. Use `git mv` for the
directory so history follows.

**Out of scope:** any code change inside the app; touching `apps/server` or
`packages/*`; dependency changes; creating the new client (ticket 02).

- [x] The directory is `apps/legacy-web` and its package name is `@bookkeeping/legacy-web`.
- [x] Root scripts `dev:web` and `start:web` are renamed `dev:legacy-web` and `start:legacy-web` and filter the renamed package; `dev:web` / `start:web` are left absent for ticket 02 to claim.
- [x] The CI workflow copies the CI env example from, and installs Playwright browsers for, the renamed package.
- [x] The Turborepo `build` outputs still cover the Next.js output directory.
- [x] `pnpm run ci` is green.
- [x] The legacy browser suite passes on its `phone` project run alone (this ticket only: `pnpm --filter @bookkeeping/legacy-web test:e2e -- --project=phone`).

**Verify:** `pnpm run ci`, then the legacy phone project as above. Do not run
the desktop project.

## Comments

Landed: `git mv apps/web apps/legacy-web`; package renamed to
`@bookkeeping/legacy-web`; root `dev:legacy-web` / `start:legacy-web` replace
`dev:web` / `start:web`; `ci.yaml`, `biome.json`, `sonar-project.properties`,
`.gitignore`, `.actrc`, the `pnpm-lock.yaml` importer key, the root
`.env.local.example` comment, `README.md`, and `docs/code-conventions.md` follow
the new path. No file inside the app changed except its `package.json` name.
The `apps/web/.env` mentions in `apps/server/.env.example` and
`packages/database/.env.example` comments were left stale on purpose: both
trees are out of scope here and ticket 13 rewrites them. Root `turbo.json`
`build.outputs` is path-agnostic (`.next/**`), so it needed no change.
Historical records (`.scratch/*`, ADRs, `docs/research/*`) keep `apps/web`.

Verification: `pnpm run ci` green (13 check/test tasks, 2 builds). Legacy phone
project: 21/21 passed via `turbo run test:e2e:ci --filter=@bookkeeping/legacy-web
-- --project=phone` (production server).

Deviations to note:

- The ticket's exact command (`pnpm --filter … test:e2e -- --project=phone`)
  does not select a project: pnpm forwards the literal `--`, so Playwright
  ignores the flag and runs both projects. Drop the `--` (`pnpm --filter
@bookkeeping/legacy-web test:e2e --project=phone`). Pre-existing; not fixed
  here because the runner is inside the app and out of scope.
- The dev-server variant (`test:e2e`) fails locally on this WSL2 machine
  (first test hits the 60 s timeout during Turbopack compile; the sign-up
  flow logs "Fresh-user provisioning retry failed"). Confirmed identical on
  a pre-rename worktree of `a14f43b`, so it is environmental, not caused by
  this change; the production-server run above is the passing evidence.
