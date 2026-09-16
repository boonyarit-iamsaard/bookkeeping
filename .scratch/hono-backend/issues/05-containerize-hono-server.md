# 05: Containerize the production-built Hono server

**What to build:** Provide a production-like local stack that builds the Hono
server image and runs it with PostgreSQL without selecting a hosting provider.

**Blocked by:** 04: Run Next.js and Hono together locally

**Status:** done

- [x] A multi-stage image builds and starts the server's production output with production dependencies.
- [x] The Compose override adds Hono to the existing PostgreSQL topology and waits for database health.
- [x] The database-only command explicitly selects the base Compose definition and does not launch Hono.
- [x] The production-like stack reaches the server health resource using explicit injected configuration.
- [x] A repeatable smoke check starts, verifies, and cleanly stops the stack.

## Comments

- Added `apps/server/Dockerfile` as a multi-stage Node.js image. The build stage
  compiles the server and creates production dependencies with the legacy
  `pnpm deploy` path; the runtime stage runs only `dist/server.js` as the
  non-root `node` user.
- Added the automatically loaded Compose override with explicit `HOST` and
  `PORT`, a server health check, PostgreSQL `service_healthy` ordering, and the
  existing bookkeeping network. `db:start` and `db:stop` now explicitly select
  `docker-compose.yaml` so database-only commands do not include the override.
- Added `pnpm container:smoke`, which builds and waits for the full stack,
  verifies `GET /health`, and removes the containers on success, failure, or
  interruption while retaining the PostgreSQL volume. The root CI command runs
  the smoke check after the browser suite so exclusive workloads stay
  sequential.
