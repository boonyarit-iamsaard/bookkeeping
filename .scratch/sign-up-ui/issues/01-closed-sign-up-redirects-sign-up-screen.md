# 01: Closed Sign-up sends `/sign-up` to sign-in

Read `../spec.md` first.

**What to build:** The API tells anyone, without a session, whether Sign-up is
open, based on `AUTH_SIGN_UP_ENABLED`, which stays the only switch. The web
checks this once per app session and treats a failed or unexpected answer as
closed. When Sign-up is not open, visiting `/sign-up` lands on `/sign-in`. When
it is open, `/sign-up` works exactly as today.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A public `GET /sign-up` answers `200` with `{ "signUp": "open" }` or
      `{ "signUp": "closed" }`, needs no session, and sits outside `/v1` and
      `/api/auth`.
- [ ] With `AUTH_SIGN_UP_ENABLED` unset, `true` or `false`, the endpoint answers
      `"open"`, `"open"` or `"closed"` respectively. An in-process server test
      covers all three, following the health route test's pattern.
- [ ] The route is registered in the OpenAPI document. The Hono contract test
      checks the response against it.
- [ ] `docs/api-parity.md` has a row for the web's Sign-up check.
- [ ] The web's Sign-up query, shaped like the session query:
  - resolves `"open"` or `"closed"`;
  - resolves `"closed"` on a rejected request, a non-2xx response, or a
    malformed body;
  - answers a second read from the cache.

  Its unit test covers each case with the API call mocked.

- [ ] `/sign-up` redirects to `/sign-in` unless the answer is `"open"`.
- [ ] The service worker treats the new path as network-only, like `/v1` and
      `/api/auth`.
- [ ] One focused auth browser spec on one project passes with Sign-up open.
- [ ] Browser check with Sign-up closed:
  1. Postgres is up via `pnpm db:start`. If Docker Desktop isn't running, stop
     and report it rather than working around it.
  2. `AUTH_SIGN_UP_ENABLED=false` is set in the local `apps/server/.env`.
  3. The `api` and `web` dev servers are started from `.claude/launch.json`.
  4. `GET /sign-up` on the API answers `{"signUp":"closed"}`.
  5. Opening `/sign-up` in the browser ends on `/sign-in`, with a screenshot as
     proof.
- [ ] `apps/server/.env` is restored to its previous Sign-up setting. After an
      `api` restart, `/sign-up` shows the form again.
- [ ] `pnpm run ci` passes.
