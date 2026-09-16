# 01: Create the Hono server shell and health check

**What to build:** Introduce a standalone Node.js Hono application that can be
developed, tested, built, and started independently, with a health resource that
proves the process is ready to serve requests.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The server exposes a successful health response through an in-process HTTP test.
- [x] Development, type-check, test, build, and production-start tasks work for the server app.
- [x] The production start path runs compiled production output rather than a development runner.
- [x] Existing web application checks remain green.

## Comments

- Implemented as `apps/server` (`@bookkeeping/server`): a standalone Node.js
  Hono app with `GET /health`, Zod-validated `PORT`/`HOST` environment parsing,
  and `start` running the compiled `dist` output. Health and environment are
  covered by unit tests, including an in-process HTTP test through
  `createApp().request()`.
