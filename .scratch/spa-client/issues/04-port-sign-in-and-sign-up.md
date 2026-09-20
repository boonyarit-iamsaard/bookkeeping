# 04: Port sign-in and sign-up

Read `../worker-brief.md` first.

**What to build:** A person can sign up, sign in, and sign out in the new
client against the Hono-mounted Better Auth, and every app route is guarded:
an unauthenticated visit redirects to sign-in, a signed-in visit to the auth
pages redirects to wallets. The header shows the account menu with the
signed-in email and Sign out.

**Blocked by:** 03: Generate the typed API client and the write helper

**Status:** ready-for-agent

**Pattern to copy:**

- Legacy `features/auth`: the sign-in and sign-up forms, their schemas and
  form hooks, and the account menu, copied verbatim; replace the Next.js
  `useRouter` navigation with TanStack Router's.
- Better Auth React client created in `core/auth`, `baseURL` = the API
  origin from `core/env`, credentialed. Session read through its
  `useSession`, exposed to the router context.
- Guard: a pathless layout route for the app group whose `beforeLoad`
  redirects when the session is absent, and one for the auth group that
  redirects when present. This is the optimistic client check; every API
  call is still authenticated by the cookie, and a `401` from the API client
  clears the query cache and redirects to sign-in.
- Provisioning retry: the legacy "complete provisioning" step after sign-up
  becomes a call to the categories defaults endpoint through the generated
  client, with the same retry behaviour the legacy action had.
- Browser helper: re-create the legacy `sign-up-fresh-user` helper for the
  new suite; every later spec uses it.

**Out of scope:** password reset, email verification, social sign-in (none
exist today); changing header layout; wallets or any other route (they can
be placeholder routes that only prove the guard).

- [ ] Sign-up creates the user, provisions default categories, and lands on `/wallets` (placeholder allowed) showing the email in the account menu.
- [ ] Sign-in with wrong credentials shows the same error text the legacy form shows, with the entered email preserved.
- [ ] Visiting `/wallets` signed out redirects to `/sign-in`; visiting `/sign-in` signed in redirects to `/wallets`.
- [ ] Sign out returns to `/sign-in` and a back navigation does not show app content.
- [ ] Browser spec `auth.spec.ts` covers the four scenarios above and passes on `phone-chromium`.
- [ ] `pnpm run ci` is green.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium auth`.
