# 04: Port sign-in and sign-up

Read `../worker-brief.md` first.

**What to build:** A person can sign up, sign in, and sign out in the new
client against the Hono-mounted Better Auth, and every app route is guarded:
an unauthenticated visit redirects to sign-in, a signed-in visit to the auth
pages redirects to wallets. The header shows the account menu with the
signed-in email and Sign out.

**Blocked by:** 03: Generate the typed API client and the write helper

**Status:** done

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

- [x] Sign-up creates the user, provisions default categories, and lands on `/wallets` (placeholder allowed) showing the email in the account menu.
- [x] Sign-in with wrong credentials shows the same error text the legacy form shows, with the entered email preserved.
- [x] Visiting `/wallets` signed out redirects to `/sign-in`; visiting `/sign-in` signed in redirects to `/wallets`.
- [x] Sign out returns to `/sign-in` and a back navigation does not show app content.
- [x] Browser spec `auth.spec.ts` covers the four scenarios above and passes on `phone-chromium`.
- [x] `pnpm run ci` is green.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium auth`.

## Comments

Landed in `apps/web`:

- `core/auth/client.ts` creates the Better Auth React client with `baseURL`
  = `clientConfig.apiOrigin` and credentialed fetch. `core/auth/session.ts`
  caches `authClient.getSession()` as a TanStack Query (`sessionQuery`,
  `staleTime: Infinity`, `retry: false`); `readSession(queryClient)` is what
  the guards call, and `resetSessionCache(queryClient)` clears the whole
  cache on sign-in, sign-up, sign-out, and a 401.
- Guards: `routes/_app.tsx` (pathless layout) redirects to `/sign-in` when
  the session is absent and returns it to the route context; the layout
  renders `AppHeader` with the `AccountMenu` in its trailing slot.
  `routes/_auth.tsx` redirects to `/wallets` when a session exists and wraps
  the legacy `(auth)/layout.tsx` markup. `/` redirects to `/wallets`;
  `routes/_app/wallets.tsx` is the placeholder that proves the guard.
- `core/api/unauthenticated-middleware.ts` is an `openapi-fetch` middleware
  installed in `main.tsx`: a 401 resets the cache and `replace`-navigates
  to `/sign-in`. The router is created with `{ queryClient }` as context
  (`createRootRouteWithContext`); the Query provider moved from `__root`
  to `main.tsx` so both sides share the one client.
- `features/auth`: forms, hooks, account menu and `completeProvisioning`
  copied from legacy; only `next/link` → `Link to`, `useRouter` →
  `useNavigate` + `resetSessionCache` (the `router.refresh()`
  equivalent), and the Server Action → `apiClient.POST("/v1/categories/defaults")`
  through `readApiResponse`, with the legacy failure reporting and unit test.
  Post-sign-in target is `/wallets` as the ticket says (legacy `/dashboard`;
  ticket 11 should point `/` and the sign-in/up hooks back at it).
- Titles: `head` on root and each route plus `HeadContent`, matching the
  legacy `metadata.title` values.
- Browser: `tests/e2e/helpers/sign-up-fresh-user.ts` is a verbatim copy;
  `auth.spec.ts` covers the four scenarios; `shell.spec.ts` now signs up
  first because `/` is guarded. `run.ts` passes the API origin as
  `VITE_API_ORIGIN` to the client, and under `CI=1` builds its own copy into
  a temp directory (the origin is baked at build time and the port is only
  known then) that `vite preview --outDir` serves; it also drops the
  leading `--` pnpm forwards so the ticket's verify command works as written.

Verification: `pnpm run ci` green (15 check/test tasks, 3 builds);
`pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium auth`
4/4; `turbo run test:e2e:ci --filter=@bookkeeping/web -- --project=phone-chromium auth`
4/4 through the preview build. The first run, before the `--` fix, ran the
full matrix: all three projects passed once the spec's assertions were
corrected.

Deviations and decisions:

- Session not read through `useSession`: a `useSession` snapshot passed as
  `RouterProvider` context lags the React render, so a navigation right
  after sign-in would run the guard against the stale context. The guard
  reads the cached `getSession()` instead, which every session change
  resets; the account menu's email comes from the `_app` route context, as
  the legacy `(app)/layout.tsx` read it server-side.
- `AppHeader` takes the account menu as a slot rather than importing it, so
  `core/shell` stays free of feature code.
- No legacy `auth.spec.ts` existed, so nothing was retired; the legacy
  `sign-up-fresh-user` helper stays because every legacy spec uses it.
- WebKit reports a redirect during document load as an interrupted load, so
  the specs visit guarded URLs with `waitUntil: "commit"`.
- Reviewed with `/code-review`; applied `Readonly` on `SignInForm` props,
  the header slot, `retry: false` on the session query, and one name for
  the CI build directory. Left as is: the identical tails of the two form
  hooks (legacy shape), `/dashboard` in the copied helper's URL pattern
  (ticket 11), and no error handling in `beforeLoad` when the session read
  itself fails (the router's error component shows).
