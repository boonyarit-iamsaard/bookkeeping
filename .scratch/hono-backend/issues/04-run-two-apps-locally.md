# 04: Run Next.js and Hono together locally

**What to build:** Make the transitional Next.js UI and Hono API easy to run
together with explicit, independently configurable local origins.

**Blocked by:** 01: Create the Hono server shell and health check

**Status:** ready-for-agent

- [ ] The root development workflow starts both applications and propagates termination cleanly.
- [ ] Each app validates only the environment values it owns.
- [ ] Local web and API origins are documented and represented in environment examples.
- [ ] Database-only commands continue to work independently of either app.
- [ ] Workspace type-check and build tasks recognize both applications.
