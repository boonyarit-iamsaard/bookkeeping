# 10: Share Better Auth while preserving the Next.js login flow

**What to build:** Give framework-independent Better Auth configuration one
package owner while preserving current sign-in, sign-up, and session behavior in
the Next.js application.

**Blocked by:** 09: Create the application package with category provisioning

**Status:** ready-for-agent

- [ ] Better Auth configuration, database adapter, and shared session contracts have one owner in the auth package.
- [ ] The Drizzle adapter uses transactions for Better Auth's own multi-write flows.
- [ ] The Next.js route remains a thin framework mount over the shared auth configuration.
- [ ] Existing browser authentication behavior and protected-page behavior remain unchanged.
- [ ] Auth package and web adapter tests cover successful and failed session resolution.
