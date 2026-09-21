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

**Status:** done

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

- [x] `pnpm --filter @bookkeeping/web generate:api` writes the OpenAPI JSON and the TypeScript types; both are committed.
- [x] `pnpm --filter @bookkeeping/web build` regenerates and fails with a clear message when the committed files differ from the server's document.
- [x] A query-options factory exists for every `GET` under `/v1`, and a unit test asserts the set of factories matches the paths in the committed document.
- [x] `useApiMutation` unit tests cover: a key is sent; the same key is reused on a network-error replay and a fresh key on the next user submit; a second call while pending is ignored; a `422` maps to field errors by name; a non-422 problem yields a message.
- [x] `pnpm run ci` is green.

**Verify:** `pnpm run ci`. No browser spec for this ticket.

## Comments

Landed in `apps/web`:

- `scripts/generate-api.ts` builds the server's app through
  `createUnitTestApp` (no database, no running server), requests
  `/openapi.json`, and writes `src/core/api/openapi.json` plus
  `src/core/api/openapi.gen.ts` with `openapi-typescript`. `generate:api`
  runs it; `build` runs it with `--check`, which fails when either file is
  not committed exactly as regenerated (`git status --porcelain`), so a
  freshly regenerated but uncommitted client also fails the build until it
  is committed. `@bookkeeping/server` is a `devDependency` of the client for
  this script only; Turborepo builds the server first.
- `core/env/config.ts` parses `VITE_API_ORIGIN` with Zod into
  `clientConfig.apiOrigin`; `.env.example` documents it. The Vitest config
  sets the variable so `core/api` modules import in tests. The e2e runner
  does not set it yet: the shell spec never reaches the API, and the CI
  preview is built before the API port is known. Ticket 04 has to decide
  how the built client learns the API origin.
- `core/api/client.ts` creates the `openapi-fetch` client with
  `credentials: "include"`; `core/api/queries.ts` exports `walletQueries`,
  `categoryQueries`, `transactionQueries`, and `reportQueries`, one
  `queryOptions` factory per `/v1` GET, keyed by OpenAPI path and
  parameters. Each factory makes its own concrete `apiClient.GET` call
  because openapi-fetch's generic call cannot be typed across all paths.
- `core/api/write-submission.ts` owns the write mechanics framework-free
  (`createWriteSubmission`: key per submit handed to `send` as the
  documented `params: { header }` shape, in-flight join, one same-key replay
  when `fetch` rejects with a `TypeError`, `Result` with `ApiRejection`), and
  `core/api/use-api-mutation.ts` wraps it in `useMutation`, exposing
  `submit` and `isPending`. The unit tests the ticket lists for
  `useApiMutation` run against `createWriteSubmission`, since the client
  has no DOM test environment and the brief forbids component render tests;
  the hook adds no logic of its own.

Deviations and decisions:

- Field-error messages: the API sends only a `code` per field pointer, no
  prose, so `ApiRejection.fieldErrors` uses the caller's
  `describeFieldError` (the legacy per-feature message tables move there
  in tickets 05 onward) and falls back to the problem's `detail`, then a
  generic sentence. The raw `errors` with the decoded request field are
  exposed beside it. A pointer's first segment is the field
  (`#/openingAmount/value` maps to `openingAmount`).
- A second `submit` while one is in flight resolves to the in-flight
  outcome instead of starting a request, so form hooks need no
  "ignored" branch.
- `biome.json` excludes the two generated files, as it does
  `routeTree.gen.ts`.
- Reviewed with `/code-review`; applied: the shared `readApiResponse` in
  `problem.ts` for reads and writes, replay limited to network errors, the
  helper owning the header name, and a count check so a factory added to
  `queries.ts` must also appear in the coverage test. Left as is: the
  client-side `ApiProblem` keeps `code: string` because the body is
  untrusted input parsed at the boundary; the deep import of
  `@bookkeeping/server/src/...` stands until a server ticket adds a subpath
  export.
