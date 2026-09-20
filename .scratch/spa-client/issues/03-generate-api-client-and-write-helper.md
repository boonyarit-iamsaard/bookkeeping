# 03: Generate the typed API client and the write helper

Read `../worker-brief.md` first.

**What to build:** A typed client for every `/v1` operation, generated from
the Hono server's `/openapi.json` as part of the client build, so the build
fails when the checked-in client no longer matches the API. On top of it, one
shared write helper every future form uses: it sends a client-generated
`Idempotency-Key`, refuses a second submit while one is in flight, retries
the same key when the response is lost, and maps a problem-details rejection
to field errors. No screens.

**Blocked by:** 02: Scaffold the Vite client shell and browser harness

**Status:** ready-for-agent

**Pattern to copy:**

- Generation: emit the OpenAPI document with the server's existing exporter
  (the test helper that writes the document, or the running app's
  `/openapi.json`) into a checked-in JSON file, generate TypeScript from it
  with `openapi-typescript`, and call it through `openapi-fetch` with
  `credentials: "include"` and the API origin from a `VITE_API_ORIGIN`
  environment variable parsed with Zod in `core/env`. A `generate:api`
  script does both steps; `build` runs it and then fails if `git diff` shows
  the generated files changed.
- Reads: a `core/api` module exports the client and a TanStack Query
  `queryOptions` factory per read (`walletQueries.list()`, …). Cached reads
  keep the server's response shape; no reshaping layer.
- Writes: a `useApiMutation` hook (TanStack Query `useMutation`) that
  generates one UUID key per submit attempt, sends it as `Idempotency-Key`,
  keeps `isPending` true until settled, retries once with the same key on a
  network error, and turns a `422` problem's field errors into the shape the
  copied `FieldErrors` component already reads. A non-field problem becomes
  the error-bar message.
- Field-error mapping mirrors how the legacy Server Actions returned
  `fieldErrors` to the form hooks, so ticket 05 onward can copy those hooks.

**Out of scope:** Better Auth (04); any UI; adding endpoints or changing the
OpenAPI document; caching API responses in a service worker; generic
retry/backoff beyond the single same-key replay.

- [ ] `pnpm --filter @bookkeeping/web generate:api` writes the OpenAPI JSON and the TypeScript types; both are committed.
- [ ] `pnpm --filter @bookkeeping/web build` regenerates and fails with a clear message when the committed files differ from the server's document.
- [ ] A query-options factory exists for every `GET` under `/v1`, and a unit test asserts the set of factories matches the paths in the committed document.
- [ ] `useApiMutation` unit tests cover: a key is sent; the same key is reused on a network-error replay and a fresh key on the next user submit; a second call while pending is ignored; a `422` maps to field errors by name; a non-422 problem yields a message.
- [ ] `pnpm run ci` is green.

**Verify:** `pnpm run ci`. No browser spec for this ticket.
