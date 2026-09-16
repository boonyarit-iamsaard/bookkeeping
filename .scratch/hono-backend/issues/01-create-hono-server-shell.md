# 01: Create the Hono server shell and health check

**What to build:** Introduce a standalone Node.js Hono application that can be
developed, tested, built, and started independently, with a health resource that
proves the process is ready to serve requests.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The server exposes a successful health response through an in-process HTTP test.
- [ ] Development, type-check, test, build, and production-start tasks work for the server app.
- [ ] The production start path runs compiled production output rather than a development runner.
- [ ] Existing web application checks remain green.
