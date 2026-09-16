# Hono backend and shared package extraction

Status: ready-for-agent

Design confirmed on 2026-09-16. This specification consolidates the grilling,
architecture decisions, and primary-source research for ticketing.

## Problem Statement

The application is a single Next.js deployment whose authenticated reads use
Server Components and whose writes use Server Actions. Personal-finance
operations, PostgreSQL access, Better Auth configuration, transport mapping,
and browser concerns therefore remain colocated inside the web app. This blocks
the intended move to a standalone SPA, prevents a future mobile client from
using the same backend, and leaves no independent HTTP contract for the current
wallet, category, transaction, refund, and reporting behavior.

The project needs to introduce Hono and extract genuinely shared packages
without rewriting the frontend at the same time, guessing abstractions for
hypothetical consumers, duplicating financial rules, or performing a flag-day
migration. The project is not deployed, but every intermediate change must
remain locally runnable, buildable, and testable.

## Solution

Introduce a separately runnable Node.js Hono application as the eventual sole
application backend. Expose a versioned, resource-oriented JSON API covering
every current user-visible behavior, while retaining the existing Next.js UI as
a temporary adapter over the same application operations. Migrate gradually in
dependency order: foundations, authentication, wallets, categories,
transactions including transfers and refunds, then summaries and reports.

Extract private source packages with concrete responsibilities for domain
vocabulary, PostgreSQL/Drizzle access, application behavior, and Better Auth.
Keep HTTP contracts in the Hono application until a later SPA becomes their
second consumer. Give the SPA origin and API origin separate host-only session
cookies during the transition, and remove the Next.js auth adapter only in the
later frontend migration.

Define exact runtime-validated request and response contracts, generate an
OpenAPI 3.1 document, preserve financial precision, use idempotency for resource
creation, paginate growing transaction collections with opaque cursors, and use
standard Problem Details failures. Provide normal two-app development commands.

## User Stories

1. As a maintainer, I want Hono to run independently from Next.js, so that the backend has a framework-neutral deployment boundary.
2. As a maintainer, I want the current Next.js application to remain usable during migration, so that each ticket leaves a working product.
3. As a maintainer, I want capabilities migrated one at a time, so that failures and regressions remain localized and reversible.
4. As a maintainer, I want each business operation to have one implementation, so that Next.js and Hono cannot drift in financial behavior.
5. As a maintainer, I want framework-independent vocabulary in a domain package, so that browser, backend, and persistence code use the same concepts.
6. As a maintainer, I want PostgreSQL and Drizzle concerns in a database package, so that persistence has one concrete owner.
7. As a maintainer, I want use cases and financial invariants in an application package, so that transport adapters remain thin.
8. As a maintainer, I want Better Auth configuration in an auth package, so that Next.js and Hono can share it without duplication.
9. As a maintainer, I want explicit feature subpath exports, so that consumers depend on narrow public interfaces rather than package internals.
10. As a maintainer, I want private packages to expose TypeScript source, so that migration does not introduce unnecessary publication builds and watch pipelines.
11. As a maintainer, I want app-owned environment validation, so that shared packages do not read ambient configuration implicitly.
12. As a maintainer, I want database changes applied with `db:push`, so that the unsettled model does not accumulate migrations.
13. As a web user, I want sign-in and session behavior to continue working during migration, so that the temporary Next.js UI remains usable.
14. As a future SPA user, I want authentication handled by Hono, so that the browser no longer depends on Next.js server APIs.
15. As a maintainer, I want session cookies scoped to their API host, so that unrelated subdomains do not receive authentication secrets.
16. As a maintainer, I want an exact cross-origin allowlist and enabled origin/CSRF checks, so that credentialed browser requests remain protected.
17. As a new user, I want default categories initialized automatically, so that my first transaction can be categorized immediately.
18. As a new user, I want interrupted provisioning to retry safely, so that a committed auth user is not left permanently unusable.
19. As an API client, I want stable versioned application routes, so that future installed clients can coexist with later API changes.
20. As an API client, I want ordinary resource-oriented HTTP methods and paths, so that request intent is predictable.
21. As an API client, I want wallets to support listing, retrieval, creation, opening-balance correction, archival, restoration, and guarded deletion.
22. As an API client, I want categories to support initialization, listing, creation, editing, usage checks, and guarded removal.
23. As an API client, I want income, expenses, transfers, and refunds to preserve the same ownership and financial invariants as the current UI.
24. As an API client, I want transaction listing and detail reads, so that a non-Next client can render financial history.
25. As an API client, I want wallet, category, type, and calendar-date filters, so that transaction exploration matches the current product.
26. As an API client, I want monthly financial summaries, so that reports do not require client-side financial calculation.
27. As an API client, I want exact semantic money values, so that no amount loses precision or arrives as presentation-only text.
28. As an API client, I want the server to validate and transform money input, so that client-side validation is only a usability enhancement.
29. As an API client, I want calendar dates distinguished from recorded instants, so that timezone conversion cannot change financial dates.
30. As an API client, I want safe request retries, so that network uncertainty does not duplicate wallets, categories, or transactions.
31. As an API client, I want conflicting reuse of an idempotency key rejected, so that a retry cannot silently apply a different command.
32. As an API client, I want opaque cursor pagination, so that new transactions do not shift later pages and cause ordinary skips or duplicates.
33. As an API client, I want stable machine-readable failure codes, so that UI behavior never depends on English prose.
34. As an API client, I want field-level validation locations, so that forms can associate server failures with the correct inputs.
35. As a support engineer, I want every response correlated with server logs, so that failures can be investigated without exposing internal errors.
36. As a maintainer, I want an OpenAPI document generated from runtime schemas, so that documentation and validated behavior share a source of truth.
37. As a maintainer, I want authenticated and unauthenticated HTTP contract tests, so that the actual API boundary—not only internal functions—is verified.
38. As a maintainer, I want root development commands to run both applications, so that the complete transitional system is easy to start.
39. As a maintainer, I want CI to build and test both apps and all packages, so that extraction cannot leave an unverified workspace.
40. As a maintainer, I want behavioral API parity audited before this effort closes, so that no current user workflow is silently omitted.

## Implementation Decisions

### Migration boundary and sequence

- Hono becomes the eventual sole backend for application reads, writes,
  authentication, authorization, and HTTP serialization.
- The initial Hono runtime is Node.js. Runtime-specific construction remains at
  the app edge; no speculative edge-runtime abstraction is required.
- Migrate with parallel change: Next.js and Hono coexist, share extracted
  behavior, and remain green after every ticket. There is no flag-day move.
- Establish the server shell, health check, environment boundary, test harness,
  and auth integration before protected capability routes.
- Migrate capabilities in dependency order: wallets, categories, transactions
  including transfers and refunds, then monthly summaries and reports.
- API parity is behavioral. Expose everything needed for current user-visible
  workflows, not every exported internal helper. Internal transaction change
  history remains private without a user-facing requirement.
- Retain the thin Next.js Server Actions, Server Components, auth mount, and
  current browser test suite at the end of this effort. The later SPA migration
  removes them.

### Package graph

- Create private packages named `@bookkeeping/domain`,
  `@bookkeeping/database`, `@bookkeeping/application`, and
  `@bookkeeping/auth`.
- Domain owns framework-independent feature vocabulary, exact money and
  calendar-date value behavior, generic result support used by business
  behavior, and pure invariants. It contains no React, Next.js, Hono, Drizzle,
  HTTP DTO, environment, or presentation concerns.
- Database owns the Drizzle schema and configuration, database construction,
  PostgreSQL-backed test fixtures, and schema push command. It imports domain
  vocabulary where persistence requires it and receives validated runtime
  configuration from consumers.
- Application owns use cases, database-backed queries, financial invariants,
  concurrency behavior, and explicit success/failure results. It depends on
  the concrete database package; do not introduce repository interfaces while
  only one database implementation exists.
- Auth owns framework-independent Better Auth configuration, its database
  adapter, session contracts, and fresh-user provisioning hook. Framework mounts
  and browser clients remain app adapters.
- Packages expose TypeScript source through explicit feature subpath exports.
  Avoid broad root barrels and independent publication builds. Each package
  still owns type-check and test tasks.
- Extract only the foundations required by the next capability. Update imports
  and tests in the same step, and never keep duplicate operation implementations.
- HTTP schemas and presenters remain owned by Hono until a later client becomes
  their second real consumer.

### Authentication and provisioning

- The browser and API use separate origins under the same site. Clients send
  credentialed requests to an exact configured API origin.
- Configure Hono CORS before authentication routes, allow only configured SPA
  origins, expose required response headers, and keep Better Auth origin and
  CSRF checks enabled.
- Use host-only, HTTP-only API cookies; do not enable parent-domain cookie
  sharing.
- During parallel change, mount the same Better Auth configuration in Next.js
  and Hono against the same database and secret. Each origin issues and consumes
  its own host-only cookie. Remove the Next.js mount only with the later SPA.
- Enable transactional Better Auth Drizzle operations for auth's own multi-write
  flows.
- Better Auth's post-create database hook is the normal default-category trigger,
  but it runs after the auth transaction commits. Call an application-owned
  initializer that creates the complete default set transactionally and
  idempotently.
- Provide an explicit authenticated provisioning retry after signup/sign-in.
  This is lifecycle recovery, not a legacy backfill or a side effect of category
  reads. No predeployment legacy-user migration is required.
- Derive every owner identifier from the authenticated session. Never accept an
  owner identifier from a client.

### HTTP resources and methods

- Serve application resources below `/v1`. Keep managed authentication routes
  and operational health checks outside the application version namespace.
- Use resource nouns and standard method semantics. Create resources with POST,
  retrieve them with GET, replace complete subordinate resources with PUT,
  partially change resource state with PATCH, and remove them with DELETE.
- Model wallet archival and restoration as changes to wallet state, not
  `/archive` and `/restore` command routes.
- Model the opening balance as a complete subordinate resource so its amount and
  date change together.
- Return `201 Created`, the direct created representation, and `Location` for
  successful creation. Return the updated representation for successful state
  changes. Return `204 No Content` for deletion when no representation is useful.
- Runtime request and response schemas are authoritative and produce OpenAPI
  3.1. Serve the generated document from the API and verify in CI that schemas,
  documented operations, and contract tests remain aligned.

### Money, dates, and mapping

- Represent money in requests and responses as a semantic object containing a
  currency code and exact major-unit decimal string. For THB, response values
  always contain two fractional digits; request values may contain zero, one,
  or two.
- Hono validates currency support, grammar, sign, and transport-level bounds,
  then converts the decimal string directly to integer satang without passing
  through a JavaScript number.
- Application operations continue to use `bigint` minor units and enforce
  financial invariants independently of HTTP validation. PostgreSQL retains
  exact integer storage and integrity constraints.
- Explicit response presenters convert internal money to canonical decimal
  strings. A preformatted label such as a currency symbol plus digits is never
  the canonical financial value.
- Clients own localized display and may repeat input checks for immediate
  feedback, but server validation is authoritative and financial calculations
  remain server-side.
- Calendar dates use `YYYY-MM-DD`, report months use `YYYY-MM`, and instants use
  UTC RFC 3339 strings. Financial calendar dates never undergo timezone
  conversion.

### Idempotency, pagination, and response contracts

- Require a client-generated `Idempotency-Key` header for wallet, category, and
  transaction creation.
- Scope idempotency to authenticated owner and operation. Bind a key to the
  canonical validated payload and commit the receipt atomically with the
  created resource.
- A retry with the same key and payload replays the original success; the same
  key with a different payload returns a conflict. Concurrent duplicates
  execute once, distinct keys permit intentional duplicates, and validation
  failures do not consume a key.
- Cursor-paginate growing transaction collections from the first version. Keep
  wallet and category lists unpaginated.
- Use an opaque cursor containing the full deterministic ordering position and
  bind it to active filters. Accept a bounded limit and do not add total counts
  without a concrete product requirement.
- Return single-resource successes directly. Return collections as an `items`
  array beside page metadata containing a nullable next cursor. Do not impose a
  global success wrapper.
- Return failures as RFC 9457 Problem Details with
  `application/problem+json`. Use a stable
  `urn:bookkeeping:problem:<code>` type and a required matching kebab-case code.
- Titles are stable developer summaries, details are optional occurrence prose,
  and clients never parse either. Structured domain details are typed per code;
  validation problems contain machine-readable field errors addressed by JSON
  Pointer.
- Map malformed requests, authentication failures, authorization failures,
  missing resources, conflicts, invalid commands, rate limits, unexpected
  faults, and unavailable service conditions to their appropriate HTTP status.
  Do not expose exception messages, SQL errors, stack traces, secrets, or paths.
- Generate a fresh opaque request identifier at the API boundary, attach it to
  logs and every response header, and do not trust arbitrary browser-provided
  identifiers as the server log key. Keep tracing context separate.
- Expose the request identifier and creation location headers through CORS.

### Development, build, and operations

- Root development starts Next.js and Hono concurrently with explicit local
  origins. Root build covers both apps and all packages.
- Update workspace task outputs, root scripts, continuous integration,
  environment examples, static analysis scope, and documentation as ownership
  moves. Do not run exclusive browser, production-build, or Sonar workloads
  concurrently with other heavy suites.

## Testing Decisions

- Prefer the highest stable seam that proves externally observable behavior.
  Do not assert private helper calls, framework middleware order beyond visible
  effects, generated SQL text, or internal file placement.
- Pure unit tests cover money mapping, calendar-date and instant presentation,
  cursor encoding/validation, request validation, response presentation,
  problem mapping, payload fingerprinting, and other deterministic boundary
  behavior.
- PostgreSQL-backed application integration tests remain the primary proof for
  ownership, financial invariants, atomicity, concurrency, idempotency receipts,
  provisioning, and query results. Move the existing operation tests with their
  owners rather than rewriting them around HTTP.
- In-process Hono HTTP tests are the primary API seam. Exercise real routing,
  runtime validation, authenticated context, authorization, statuses, headers,
  content types, response bodies, CORS behavior, and opaque error handling.
- Every protected route has authenticated success, unauthenticated rejection,
  and cross-owner non-disclosure coverage where a resource identifier is
  accepted.
- Contract tests verify both successful and Problem Details responses against
  their runtime schemas and verify that no internal `bigint` or `Date` reaches
  JSON implicitly.
- Idempotency tests cover sequential retry, concurrent retry, changed payload,
  distinct keys, validation failure, and replay after the created record has
  subsequently changed or been removed according to existing semantics.
- Cursor tests cover deterministic tie-breaking, filter binding, empty and final
  pages, invalid cursors, server-capped limits, and inserts before the current
  position. They do not claim snapshot isolation for records whose sort fields
  are edited during pagination.
- Auth tests cover both framework mounts, separate host-only cookies, exact
  trusted origins, credentialed CORS, CSRF/origin rejection, session-derived
  ownership, transactional auth writes, post-commit provisioning failure, and
  idempotent retry.
- Retain the current Next.js Playwright suite as regression coverage. Do not
  rewrite Next-specific browser assertions during this effort; the later SPA
  initiative owns that change.
- Continuous integration runs formatting, linting, type checks, package tests,
  application/database integration tests, both app builds, Hono contract tests,
  and the existing browser suite in a resource-safe sequence.

## Out of Scope

- Replacing Next.js with TanStack Router or TanStack Start.
- Deciding between a browser SPA and an Expo/React Native client.
- Building an Expo client, mobile authentication, offline behavior, or a mobile
  SDK.
- Selecting or configuring a production hosting provider.
- Containerizing the Hono server or adding it to the local Compose stack; the
  image has no consumer until the Next.js cutover initiative, which owns it.
- Rewriting the current Next.js UI to call Hono.
- Removing Next.js Server Components, Server Actions, routing, or its temporary
  Better Auth mount.
- Rewriting the existing Playwright suite for a future SPA.
- Extracting or publishing an HTTP contract/client package before a second
  client consumes it.
- Publishing the private workspace packages.
- Generating, committing, or applying database migrations.
- Introducing repository interfaces for hypothetical database implementations.
- Exposing internal transaction change history without a user-facing feature.
- Formal double-entry accounting or event sourcing.
- Provider-specific deployment, production secrets, rate limiting, distributed
  tracing, or production observability infrastructure before a concrete
  deployment model exists.

## Further Notes

- This effort activates the existing monorepo decision that reserved a server
  app and deferred package extraction until a second consumer existed.
- Wallets are the first complete capability slice because they exercise
  ownership, exact money, reads, creation, lifecycle changes, expected failures,
  database behavior, and the HTTP contract without transaction/refund
  complexity.
- Categories follow wallets because transaction creation depends on both.
  Transactions then bring transfers, refunds, filters, cursor pagination, and
  idempotency; summaries and reports complete behavioral parity.
- The editable browser money control remains text with a decimal keyboard hint.
  It submits semantic decimal text and never converts through floating point.
- The response-contract and money-contract research notes, together with the
  accepted Hono and package-graph architecture decisions, are normative context
  for ticket generation.
