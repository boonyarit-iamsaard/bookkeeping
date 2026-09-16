# 11: Mount Better Auth and authenticated context in Hono

**What to build:** Make Hono the future authentication boundary while the
temporary Next.js mount continues serving the existing UI.

**Blocked by:** 03: Generate the initial OpenAPI contract; 10: Share Better Auth while preserving the Next.js login flow

**Status:** done

- [x] Better Auth routes are mounted in Hono outside the versioned application namespace.
- [x] Hono resolves a session into request context for protected routes and returns a standard unauthenticated problem otherwise.
- [x] API cookies are HTTP-only and host-only; parent-domain cookie sharing remains disabled.
- [x] Credentialed CORS allows only configured client origins and exposes request-identifier and location headers.
- [x] Better Auth trusted-origin and CSRF protections reject untrusted browser origins.
- [x] Tests prove that the Next.js and Hono mounts use separate cookies over one shared user store.

## Comments

- `apps/server` now consumes `@bookkeeping/auth` and `@bookkeeping/database`.
  `server.ts` builds the database, `createAuth({ trustedOrigins })`, and
  `createApp({ auth: createAuthMount(auth), clientOrigins })`. The server env
  gained `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the API
  origin), and `CLIENT_ORIGINS` (comma-separated http(s) origins, at least
  one); `.env.example` documents all four.
- `core/auth/auth.ts` defines `AuthMount` (`handleRequest`, `resolveSession`),
  the contract the HTTP layer needs from Better Auth, so unit tests substitute
  a stub while the entrypoint adapts the real instance. Better Auth is mounted
  as one `app.all("/api/auth/*")` catch-all outside `/v1`; it owns its own
  route documentation, so it is not part of the generated OpenAPI document.
- `core/auth/session.ts` exports `requireSession` and `AuthenticatedEnv`.
  `createApp` applies it to `/v1/*`, so feature routers mount as
  `new Hono<AuthenticatedEnv>()` under `/v1` and read `c.get("session")`; a
  missing or invalid cookie yields the standard `unauthenticated` problem.
- `core/http/cors.ts` allows only the configured client origins with
  credentials, allows `Content-Type` and `Idempotency-Key`, and exposes
  `X-Request-Id` and `Location`. It runs before the auth routes.
- `createAuth` accepts `trustedOrigins` and now sets
  `advanced.disableOriginCheck: false` and `disableCSRFCheck: false`
  explicitly: Better Auth silently skips both under `NODE_ENV=test`, which
  would have let the integration tests pass without exercising them.
  Cookies keep Better Auth's defaults (HTTP-only, `Path=/`, no `Domain`), and
  `crossSubDomainCookies` stays disabled. `createAuth` also accepts
  `cookiePrefix`: host-only cookies ignore the port, so on one local
  hostname two mounts with the default name would overwrite each other and,
  sharing a secret, accept each other's token. The API mount uses
  `bookkeeping-api` (`API_COOKIE_PREFIX`); the Next.js mount keeps
  `better-auth`, so its browser flow and proxy cookie check are untouched.
- Tests: `auth.unit.test.ts` covers delegation, the 401 problem, session
  context, and CORS headers with a stub mount. `auth.integration.test.ts`
  runs the real mount over the test database: a client-origin sign-up issues a
  host-only HTTP-only cookie that authenticates `/v1`; an untrusted `Origin`
  and a cross-site navigation are rejected with 403; a forged API cookie is
  401; and the Hono-created user signs in through a Next.js-style mount (same
  store and secret, its own `baseURL`) whose `better-auth.*` cookie the API
  rejects, just as the web mount rejects the `bookkeeping-api.*` cookie. The server vitest config now has
  `unit` and `integration` projects like the web app.
- Consuming TypeScript-source packages broke the `tsc` emit build (`nodenext`
  resolution versus the packages' extensionless imports), so the server now
  uses bundler resolution like the rest of the workspace and
  `scripts/build.ts` bundles `src/server.ts` plus `@bookkeeping/*` with esbuild
  into `dist/server.js`, leaving every other module external. The server
  therefore declares `better-auth`, `drizzle-orm`, and `pg` as its own runtime
  dependencies; `node dist/server.js` was verified to start.
