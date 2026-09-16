# Turborepo monorepo to prepare for a second app

The repo currently holds one Next.js app, but a separate deployment Hono API
server is planned. We adopted the standard Turborepo layout now — the app moved
to `apps/web` as `@bookkeeping/web`, with `packages/*` reserved and Turborepo
caching/parallelism for `types:check`, `test`, and `build` — so the future
`apps/server` can land without restructuring. No packages are extracted yet:
`src/` seams (`core`, `features`, `shared`) stay inside the app, and shared
packages will be carved out only when the server actually needs them, because
extracting without a consumer guesses the seam. Root-owned tooling (Biome,
Prettier, markdownlint, husky) covers the whole tree; app-bound files (configs,
tests, `.env`) live with the app.

## Considered options

- Keep the flat single-app repo and restructure when the server arrives:
  cheaper today, but converts "prepare" into a disruptive future migration.
- Root stays the app with packages alongside: avoids the move but is a
  non-standard layout that tools and contributors assume differently.
- Extract `db`/`auth`/`env` packages up front: rejected — env is Next-specific
  (`@t3-oss/env-nextjs`) and the other seams have no second consumer yet.

## Consequences

- Docker Compose stays at the repo root as shared local infrastructure; its
  credentials come from root `.env.local`, which must stay in sync with
  `DATABASE_URL` in `apps/web/.env`.
- `next dev`/`next build` manage `AGENTS.md`/`CLAUDE.md` per app root, so
  `apps/web` gets its own managed blocks alongside the repo-root copies.
- Sonar scans `apps/web/src` only.
