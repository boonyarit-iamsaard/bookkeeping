# 05: Containerize the production-built Hono server

**What to build:** Provide a production-like local stack that builds the Hono
server image and runs it with PostgreSQL without selecting a hosting provider.

**Blocked by:** 04: Run Next.js and Hono together locally

**Status:** ready-for-agent

- [ ] A multi-stage image builds and starts the server's production output with production dependencies.
- [ ] The Compose override adds Hono to the existing PostgreSQL topology and waits for database health.
- [ ] The database-only command explicitly selects the base Compose definition and does not launch Hono.
- [ ] The production-like stack reaches the server health resource using explicit injected configuration.
- [ ] A repeatable smoke check starts, verifies, and cleanly stops the stack.
