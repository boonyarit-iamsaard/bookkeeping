# 05: Containerize the production-built Hono server

**What to build:** Provide a production-like local stack that builds the Hono
server image and runs it with PostgreSQL without selecting a hosting provider.

**Blocked by:** 04: Run Next.js and Hono together locally

**Status:** wontfix

- [ ] A multi-stage image builds and starts the server's production output with production dependencies.
- [ ] The Compose override adds Hono to the existing PostgreSQL topology and waits for database health.
- [ ] The database-only command explicitly selects the base Compose definition and does not launch Hono.
- [ ] The production-like stack reaches the server health resource using explicit injected configuration.
- [ ] A repeatable smoke check starts, verifies, and cleanly stops the stack.

## Comments

- Deferred out of this initiative (2026-09-16). The image has no consumer until
  a hosting provider is chosen and the Next.js cutover makes Hono the deployed
  backend; until then a dedicated container smoke check would be the only thing
  exercising the Dockerfile, and its value disappears once real deploy and
  browser coverage exercise the image. Within this initiative Hono is verified
  in-process with vitest and testcontainers. Reintroduce the container with the
  cutover initiative, verified by that coverage rather than a standalone smoke
  script.

- Reintroduced on 2026-09-25 by `.scratch/deployment/issues/02-api-container-image.md`
  after ADR 0008 chose Railway as the hosting provider.
