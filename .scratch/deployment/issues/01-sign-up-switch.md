# 01: Switch public sign-up off by environment

Read `../worker-brief.md` first.

**Blocked by:** none

**Status:** ready-for-agent

**Why:** The trial runs on a public URL for one user. Once the owner has an
account, production refuses new sign-ups so strangers cannot add load to a
paid database. The flag changes only on a redeploy; no runtime toggle.

## Files you may edit

- `apps/server/src/core/env/config.ts`
- `apps/server/src/core/env/config.unit.test.ts`
- `apps/server/src/server.ts`
- `apps/server/.env.example`
- `packages/auth/src/config.ts`
- `packages/auth/src/config.integration.test.ts`

Nothing else. In particular: no web client change, no change to
`apps/server/src/testing/*`, no new route.

## Exact contract

1. **Environment** (`config.ts`): add `AUTH_SIGN_UP: z.enum(["on", "off"]).optional()`
   to `serverEnvSchema`, beside `AUTH_RATE_LIMIT`.
2. **Server config**: add to `ServerConfig`, with a doc comment in the style
   of its neighbours:

   ```ts
   /** False refuses new email/password sign-ups; sign-in is unaffected. */
   authSignUpEnabled: boolean;
   ```

   Mapping: absent or `"on"` → `true`; `"off"` → `false`. Unlike the rate
   limit, it is never `undefined`.

3. **Auth options** (`packages/auth/src/config.ts`): add to `AuthOptions`:

   ```ts
   /** False refuses new email/password sign-ups. Defaults to true. */
   signUpEnabled?: boolean;
   ```

   Destructure it in `createAuth` and set
   `emailAndPassword: { enabled: true, disableSignUp: signUpEnabled === false }`.
   Better Auth 1.7.4 then answers a sign-up with `400` and code
   `EMAIL_PASSWORD_SIGN_UP_DISABLED` (verified in
   `better-auth/dist/api/routes/sign-up.mjs`).

4. **Wiring** (`server.ts`): pass `signUpEnabled: serverConfig.authSignUpEnabled`
   to `createAuth`, after `rateLimitEnabled`.
5. **Documentation** (`apps/server/.env.example`): below the
   `AUTH_RATE_LIMIT` block, add:

   ```sh
   # Optional: on or off, default on. Production sets off once the owner's
   # account exists; sign-in keeps working.
   # AUTH_SIGN_UP=on
   ```

## Steps (test first)

1. In `config.unit.test.ts`, extend the existing defaults assertion with
   `authSignUpEnabled: true`, and add a test beside "reads an explicit
   authentication rate limit switch", named
   `"reads an explicit sign-up switch"`: `"off"` → `false`, `"on"` → `true`,
   `"false"` throws. Run it and watch it fail.
2. In `packages/auth/src/config.integration.test.ts`, add two tests inside
   `describe("createAuth")`, each inside `withRollback`:
   - `"a disabled sign-up refuses new users and creates no rows"`: call
     `createAuth({ db, secret: TEST_SECRET, baseURL: TEST_BASE_URL, signUpEnabled: false }).api.signUpEmail(...)`;
     expect it to reject with an error whose `body.code` is
     `"EMAIL_PASSWORD_SIGN_UP_DISABLED"`; then assert no `users` row
     exists for that email.
   - `"a disabled sign-up still signs in an existing user"`: sign up with the
     existing `signUp(db, email)` helper (sign-up enabled), then call
     `signInEmail` on a second instance built with `signUpEnabled: false`
     and expect a session.

   Run them and watch them fail.

3. Implement the contract above until both files pass.

## Acceptance criteria

- [ ] With `AUTH_SIGN_UP` absent or `on`, all existing tests pass unchanged.
- [ ] With `signUpEnabled: false`, sign-up is refused with `EMAIL_PASSWORD_SIGN_UP_DISABLED` and no user row is written.
- [ ] With `signUpEnabled: false`, an existing user signs in.
- [ ] `AUTH_SIGN_UP=false` (or any value other than `on`/`off`) fails `parseServerEnv`.
- [ ] `apps/server/.env.example` documents the variable exactly as above.
- [ ] Only the six allowed files changed.

**Verify:**

```sh
pnpm --filter @bookkeeping/server test -- src/core/env/config.unit.test.ts
pnpm --filter @bookkeeping/auth test -- src/config.integration.test.ts
pnpm run ci
```

## Traps

- Do not name the variable `DISABLE_SIGN_UP` or make it a boolean string;
  `on`/`off` matches `AUTH_RATE_LIMIT`.
- Do not change `createIntegrationTestApp` or other test helpers to pass the
  new option; the default keeps them correct.
- Do not add a client-visible "sign-up disabled" state; the spec rules it out.
