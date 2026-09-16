# 10: Share Better Auth while preserving the Next.js login flow

**What to build:** Give framework-independent Better Auth configuration one
package owner while preserving current sign-in, sign-up, and session behavior in
the Next.js application.

**Blocked by:** 09: Create the application package with category provisioning

**Status:** done

- [x] Better Auth configuration, database adapter, and shared session contracts have one owner in the auth package.
- [x] The Drizzle adapter uses transactions for Better Auth's own multi-write flows.
- [x] The Next.js route remains a thin framework mount over the shared auth configuration.
- [x] Existing browser authentication behavior and protected-page behavior remain unchanged.
- [x] Auth package and web adapter tests cover successful and failed session resolution.

## Comments

- Created `packages/auth` (`@bookkeeping/auth`) with two subpaths.
  `@bookkeeping/auth/config` exports `createAuth({ db, secret, baseURL,
plugins? })`, `AuthOptions`, and `Auth`; `@bookkeeping/auth/session`
  exports the `Session`/`SessionUser` contract and
  `resolveSession(auth, headers)`, which returns that narrowed shape or null
  instead of Better Auth's raw `{ session, user }`. The package depends on
  `@bookkeeping/database` (auth tables and the `Database` type),
  `better-auth`, and `drizzle-orm`.
- The Drizzle adapter is configured with `transaction: true`;
  `config.integration.test.ts` proves a failing `adapter.transaction` leaves
  no user row behind (it fails with the option off).
- `apps/web/src/core/auth/config.ts` is now `createAuth(...)` fed the
  validated env, the web `db`, and `nextCookies()` as the only framework
  plugin; `session.ts` delegates to `resolveSession`. The route handler,
  browser client, proxy cookie check, and every `session.user.id` /
  `session.user.email` consumer are unchanged.
- Tests: `session.integration.test.ts` in the package signs up through
  `auth.api` and resolves the issued cookie, an empty request, and a forged
  cookie; `apps/web/src/core/auth/session.integration.test.ts` runs the
  real web mount over the test database with `next/headers` mocked. The
  `wallets.spec.ts` browser spec (desktop) passed as the compatibility
  oracle for sign-up, protected redirects, and invalid-cookie rejection.
- The post-create provisioning hook is deliberately absent; it belongs to
  ticket 12. Biome overrides, Sonar scope, `.gitignore`, and the README track
  the new package.
