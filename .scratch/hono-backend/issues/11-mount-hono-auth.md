# 11: Mount Better Auth and authenticated context in Hono

**What to build:** Make Hono the future authentication boundary while the
temporary Next.js mount continues serving the existing UI.

**Blocked by:** 03: Generate the initial OpenAPI contract; 10: Share Better Auth while preserving the Next.js login flow

**Status:** ready-for-agent

- [ ] Better Auth routes are mounted in Hono outside the versioned application namespace.
- [ ] Hono resolves a session into request context for protected routes and returns a standard unauthenticated problem otherwise.
- [ ] API cookies are HTTP-only and host-only; parent-domain cookie sharing remains disabled.
- [ ] Credentialed CORS allows only configured client origins and exposes request-identifier and location headers.
- [ ] Better Auth trusted-origin and CSRF protections reject untrusted browser origins.
- [ ] Tests prove that the Next.js and Hono mounts use separate cookies over one shared user store.
