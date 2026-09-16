# Hono as the client-neutral application backend

Hono will become the sole application backend, exposing a client-neutral HTTP
boundary for the web client and any future clients. We will introduce it on
Node.js and migrate one vertical capability at a time, keeping the application
locally runnable, testable, and buildable after every ticket; Next.js may remain
as a temporary client and adapter while this migration is underway. The Hono
roadmap reaches API parity for all current capabilities; replacing the web
runtime remains a later initiative.

## Consequences

- New business operations must not depend on Next.js server features.
- Existing operation interfaces remain framework-independent; Hono owns HTTP,
  authentication, authorization, and wire-format concerns at the edge.
- Runtime request and response schemas define the HTTP contract. Expected
  failures use stable machine-readable codes and appropriate HTTP statuses;
  unexpected faults remain opaque.
- Money crosses HTTP as an object containing a currency code and an exact
  major-unit decimal string, such as `{ value: "125.50", currency: "THB" }`.
  Hono maps that representation to and from the core's integer minor units;
  clients own localized display but no financial calculation.
- The browser client and API use separate origins under one site, allowing
  independent deployment from the outset. The API keeps its session cookie
  host-only; clients send credentialed requests, Hono allows only configured
  client origins, and Better Auth origin and CSRF checks remain enabled.
- Package boundaries are extracted only when Hono becomes their second real
  consumer.
- Better Auth routes and session resolution move into Hono before protected
  capability endpoints.
- During the gradual migration, Better Auth is mounted in both Next.js and
  Hono against the same database and secret. Each origin keeps its own
  host-only cookie; the Next.js mount is a temporary compatibility adapter
  removed with the later SPA cutover.
- The JSON API is resource-oriented: paths identify resources and standard
  HTTP methods express retrieval, creation, replacement, partial modification,
  and deletion. Application operations remain explicit behind that boundary.
- Application resources start under `/v1`; managed authentication routes and
  operational health checks remain outside that version namespace.
- Resource-creating requests require a client-generated `Idempotency-Key`.
  Reusing a key with the same validated payload replays the original success;
  reusing it with a different payload is a conflict, and validation failures
  do not consume the key.
- Calendar dates use `YYYY-MM-DD`, reporting months use `YYYY-MM`, and instants
  use UTC RFC 3339 strings. Calendar dates never undergo timezone conversion.
- Growing transaction collections use opaque cursor pagination bound to their
  deterministic ordering and active filters. Small wallet and category
  collections remain unpaginated; internal change history is not exposed
  without a user-facing requirement.
- Successful single-resource responses contain the resource directly;
  collections use `{ items, page: { nextCursor } }`. Failures use RFC 9457
  Problem Details with a required stable domain `code` extension. Every
  response carries a server-generated `X-Request-Id`; created resources also
  carry `Location`, and both headers are exposed to browser clients through
  CORS.
- Problem types use stable `urn:bookkeeping:problem:<code>` identifiers while
  no canonical production domain exists.
- API parity is behavioral: every current user-visible workflow has an HTTP
  path, but internal operations are not exposed merely because a function is
  exported. Runtime schemas generate an OpenAPI 3.1 document and contract tests
  verify real responses against those schemas.
- Root development commands run the Next.js UI and Hono together. The Hono app
  also produces a standalone Node.js container image, and the base Compose file
  plus `docker-compose.override.yaml` reproduce the server with PostgreSQL
  locally without selecting a production hosting provider.
- API parity does not remove the temporary Next.js adapters or rewrite the
  existing Playwright suite. Those changes belong to the later SPA migration.
- Default categories are created idempotently during fresh-user provisioning,
  not as a side effect of reads. The post-commit Better Auth hook performs the
  normal initialization, and an explicit authenticated provisioning retry
  recovers interrupted signup or sign-in; no legacy-user backfill is required
  while the local database remains disposable. Better Auth's Drizzle adapter
  enables transactions for its own multi-write flows.
- The API avoids browser-only assumptions, but Expo-specific authentication,
  offline behavior, and client SDK work remain outside this initiative.
- Replacing the web runtime and choosing between TanStack Router and TanStack
  Start are later decisions, not prerequisites for introducing Hono.
