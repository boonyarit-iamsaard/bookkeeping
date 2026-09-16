# 04: Run Next.js and Hono together locally

**What to build:** Make the transitional Next.js UI and Hono API easy to run
together with explicit, independently configurable local origins.

**Blocked by:** 01: Create the Hono server shell and health check

**Status:** done

- [x] The root development workflow starts both applications and propagates termination cleanly.
- [x] Each app validates only the environment values it owns.
- [x] Local web and API origins are documented and represented in environment examples.
- [x] Database-only commands continue to work independently of either app.
- [x] Workspace type-check and build tasks recognize both applications.

## Comments

- Root `pnpm dev` now runs `turbo run dev`, a persistent uncached task, so
  Next.js and Hono start together and both stop on interrupt (verified: no
  listeners or child processes remain after SIGINT). `dev:web` and
  `dev:server` run one app. `turbo.json` pins strict env mode so shell `PORT`
  overrides reach neither app; each app's `dev`/`start` script loads its own
  `.env` through Node (`--env-file-if-exists`), which also lets `PORT` in
  `apps/web/.env` set the web port before Next parses its CLI. Both
  `.env.example` files document their local origin. Server env tests pin that
  web-owned variables are ignored. README documents both local origins and
  that database commands need neither app running. `turbo run build`,
  `types:check`, and `test` already resolve both workspaces.
