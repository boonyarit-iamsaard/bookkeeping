# Sign-up screens follow the sign-up switch

Status: done

Decided on 2026-09-27 by grilling. This reopens the "client-visible sign-up
state" left out of scope by `.scratch/deployment/spec.md`.

## Problem Statement

Production closes Sign-up with `AUTH_SIGN_UP_ENABLED=false`, and the server
refuses new Accounts. The web app does not know this. The sign-in screen still
says "Don't have an account? Sign up", and `/sign-up` still shows a form that
the server will reject after the visitor has filled it in. The app looks open
when it is closed.

## Solution

The web asks the API whether Sign-up is open. When Sign-up is open, the web
behaves exactly as it does today. Otherwise, the sign-in screen does not mention
Sign-up, and `/sign-up` redirects to `/sign-in`. "Otherwise" covers closed, not
yet known, and a failed check. No "Sign-up is closed" message appears anywhere.
`AUTH_SIGN_UP_ENABLED` stays the only switch, so changing it still needs only
the API redeploy.

## User Stories

1. As the owner, I want the sign-in screen to stop offering Sign-up once I close it, so that the production app doesn't advertise something it refuses.
2. As the owner, I want `/sign-up` to send me to sign-in when Sign-up is closed, so that nobody can fill in a form that is bound to fail.
3. As the owner, I want one switch, `AUTH_SIGN_UP_ENABLED`, to control both the server and the screens, so that the two can never disagree.
4. As the owner, I want reopening Sign-up to need only the API variable and its redeploy, so that I never rebuild the web to change it.
5. As the owner, I want signing in with my existing Account to work whether Sign-up is open or closed, so that closing Sign-up never locks me out.
6. As a visitor to the production app, I want to see only the sign-in form, so that I am not invited to create an Account I can't have.
7. As a visitor who opens a saved `/sign-up` link while Sign-up is closed, I want to land on sign-in, so that I don't hit a dead end.
8. As the owner, I want the sign-up link never to flash on screen before the API answers, so that the closed app never briefly looks open.
9. As the owner, I want a failed check to count as closed, so that an API outage never shows a sign-up form that couldn't succeed anyway.
10. As the owner using the installed PWA, I want the check to happen at most once per app session, so that moving between sign-in and sign-up doesn't repeat requests.
11. As a developer, I want local development and tests to keep Sign-up open by default, so that the browser tests still create fresh Accounts through the real sign-up screen.
12. As a developer, I want the endpoint in the OpenAPI document and the API parity table, so that it is documented like every other API call the web makes.
13. As a developer, I want the endpoint to answer with the words "open" and "closed", so that the API uses the same terms as the glossary.
14. As the owner following the runbook, I want the "close Sign-up" step to describe the new screen behavior, so that I can check it by looking at the app.

## Implementation Decisions

- **API contract.** A public, unauthenticated `GET /sign-up` answers `200` with
  `{ "signUp": "open" | "closed" }`.
  - It sits at the root next to the health routes, outside `/v1`, where every
    route requires a session, and outside `/api/auth`, which Better Auth owns.
  - It reads the same server config value that already feeds Better Auth's
    `disableSignUp`.
  - The shared CORS middleware already covers it.
- **Server app.** Creating the app takes a new input saying whether Sign-up is
  open, supplied at startup from the existing server config. Test app builders
  default to open.
- **OpenAPI and parity.** Register the route in the OpenAPI document. Add a row
  to `docs/api-parity.md` for the web's Sign-up check.
- **Web Sign-up query.** A new module shaped like the session query exposes
  `readSignUp(queryClient)`:
  - It resolves to `"open"` or `"closed"`.
  - It resolves to `"closed"` on any network failure, non-2xx response, or
    unexpected body.
  - The answer is cached for the app session and not refetched in the
    background.
- **Web screens.**
  - The `/sign-up` route checks Sign-up before it loads and redirects to
    `/sign-in` unless the answer is `"open"`.
  - The sign-in form shows its "Don't have an account? Sign up" text and link
    only once the answer is `"open"`. While loading, after a failure, or when
    closed, neither appears.
  - There is no closed-state notice.
- **Service worker.** Treat the new path as network-only, like `/v1` and
  `/api/auth`, so an installed PWA never serves a stale answer from a cache.
- **Vocabulary.** Use **Sign-up** (open or closed) from `CONTEXT.md` everywhere
  except the variable name, which keeps Better Auth's `*_ENABLED` form.
- **Docs.**
  - Update the README's section on the sign-up switch and step 2 of stage 11 in
    `.scratch/deployment/railway-runbook.md`, which currently expects the
    screen to show the server's rejection.
  - Leave `.scratch/deployment/spec.md` as history.

## Testing Decisions

Good tests here check what the app does from the outside: the HTTP answer for a
given switch, and the Sign-up answer the web resolves for a given API response.
They don't check internal wiring.

- **Server, in-process app request.** With the switch unset, true, and false,
  `GET /sign-up` answers `"open"`, `"open"` and `"closed"` respectively, without
  a session. Prior art: the health route unit test, which uses the in-process
  unit test app.
- **Server, Hono contract test.** The response matches its OpenAPI schema. Prior
  art: the existing API contract integration test.
- **Web, Sign-up query unit test.** Mock the API call:
  - an "open" answer resolves `"open"`;
  - a "closed" answer resolves `"closed"`;
  - a rejected request, a non-2xx response and a malformed body each resolve
    `"closed"`;
  - a second read is answered from the cache.

  Prior art: the session query unit test, which mocks `getSession`.

- **Not separately tested.** The route redirect and the sign-in link only read
  the query's answer. The web has no component-test setup, and this feature
  doesn't justify adding one.
- **No new browser tests.** The existing specs run against an API with Sign-up
  open and keep covering the open case. Per the browser test policy, run one
  focused auth spec on one project to confirm the sign-in link and the sign-up
  helper still work.

## Out of Scope

- Any message telling visitors that Sign-up is closed.
- A second browser-test API running with Sign-up closed.
- Invitations, allowlists, or any Sign-up path other than the switch.
- A build-time web setting for Sign-up.
- Changes to how the server refuses Sign-up; Better Auth's `disableSignUp`
  stays the enforcement.

## Further Notes

The server remains the authority. The screen changes are a courtesy, and a
direct `POST` to the sign-up endpoint is still refused by the server when
Sign-up is closed.
