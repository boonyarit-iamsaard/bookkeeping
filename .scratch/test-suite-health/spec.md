# Spec: Test suite ownership and cost

Status: ready-for-agent

Sources: `facts.md` (measurements, 2026-09-19) and `decisions.md` (interview
outcome). Respects ADR 0003 (Hono application backend; Next.js is a temporary
adapter; the Playwright suite is a frozen migration oracle) and ADR 0004
(shared backend package graph).

## Problem Statement

As the developer, I run `pnpm test` many times a day and wait ≈ 81 s for it,
almost all of it in the server package. When one domain rule changes, tests go
red in three packages at once, and most of those reds say the same thing. The
biggest test files are 2–3 k lines and bundle whole features, so a red test
names a cluster of rules rather than one. I cannot tell, from where a test
lives, what it is allowed to assert — so every new rule gets tested again at
every layer, and the suite keeps growing in cost without growing in meaning.

## Solution

Give each test layer a single, written responsibility, and remove the tests
that violate it:

- the application package owns business rules;
- the server route suite owns the HTTP mapping and nothing below it;
- the web package's leftover copies of application tests are retired.

Route tests stop paying for a real sign-up on every test by substituting the
authentication gateway, which is the seam that already exists for that
purpose. The result is a routine gate under 60 s whose failures point at one
layer, with the rule written into the house style so it holds.

## User Stories

1. As the developer, I want `pnpm test` to finish in ≤ 60 s wall time on my
   machine, so that I run it without hesitation between edits.
2. As the developer, I want a changed business rule to turn red in the
   application package, so that the failure names the layer that owns it.
3. As the developer, I want a changed business rule _not_ to turn red in a
   dozen route and web tests, so that I fix one thing, not a scavenger hunt.
4. As the developer, I want a broken HTTP mapping (wrong status, wrong
   problem code, wrong field error) to turn red in the route suite only, so
   that the failure names the boundary.
5. As the developer, I want to know, from a test file's location, what it may
   assert, so that I put new tests in the right place first time.
6. As a reviewer, I want a written ownership rule in the code conventions, so
   that I can reject a route test that re-proves a domain rule.
7. As the developer, I want every scenario currently covered somewhere to
   remain covered somewhere, so that this cleanup loses no behaviour.
8. As the developer, I want the application transaction tests split per
   operation, so that I can open the refund tests without scrolling past
   3 000 lines.
9. As the developer, I want route tests to provision owners without a real
   sign-up, so that each route test costs about what an application test
   costs.
10. As the developer, I want real Better Auth over HTTP still covered in one
    place, so that substituting it elsewhere is safe.
11. As the developer, I want ownership enforcement at the HTTP boundary still
    proven (another user gets 404/403, anonymous gets 401), so that the
    gateway substitution doesn't weaken security coverage.
12. As the developer, I want one route test per problem code that a feature
    can produce, so that the mapping from application failure to
    problem-details is proven once per class.
13. As the developer, I want request-validation → field-error mapping proven
    for each endpoint that accepts a body, so that clients get stable errors.
14. As the developer, I want response serialization proven against the Zod
    response schemas (money as decimal string, cursor pages), so that the
    OpenAPI document and the runtime agree.
15. As the developer, I want idempotency-key HTTP semantics proven at the
    route layer (required header, replay, conflict, key not consumed on
    application-level rejection), so that the header contract is stable.
16. As the developer, I want one happy-path round trip per endpoint in the
    route suite, so that wiring regressions are caught.
17. As the developer, I want the web package to keep its Next.js session test
    untouched, so that the temporary adapter keeps its only non-browser auth
    coverage until it is removed.
18. As the developer, I want the frozen Playwright suite left alone, so that
    ADR 0003's oracle stays intact.
19. As the developer, I want each ticket to run one package's test suite at a
    time, so that my machine doesn't run out of memory.
20. As the developer, I want the budget and ownership rule documented but not
    CI-gated on time, so that CI stays free of hardware-dependent flakes.
21. As the developer, I want the follow-up ideas (splitting cluster tests,
    extracting pure rules to the domain package) recorded but not done here,
    so that this effort stays a move-and-delete, not a refactor.
22. As the developer, I want the wallet and category suites treated the same
    way as transactions, so that the rule is uniform across features.
23. As the developer, I want the report routes' owner provisioning fixed too,
    so that the slowest per-test file in the repo (≈ 400 ms/test) benefits.
24. As the developer, I want per-package Postgres containers left as they
    are, so that package test lifecycles stay decoupled.

## Implementation Decisions

### Ownership rule

- The application package is the sole owner of business-rule coverage: date
  bounds, amount bounds, note length, category-tree membership, wallet
  archival rules, transfer rules, refund caps, idempotency replay semantics,
  history/recording-time behaviour, balance arithmetic. Other layers may rely
  on a rule inside a fixture but never assert it.
- The server route suite asserts exactly six things: (1) status code and
  problem-details mapping, one representative test per problem code the
  feature can emit (`bad-request`, `conflict`, `forbidden`,
  `idempotency-conflict`, `idempotency-key-required`, `invalid-command`,
  `not-found`, `unauthenticated` as applicable); (2) request validation →
  field-error mapping per body-accepting endpoint; (3) authentication, session
  and ownership enforcement at the boundary; (4) response serialization
  against the exported Zod response schemas; (5) idempotency-key HTTP
  semantics; (6) one happy-path round trip per endpoint. A route test may
  trigger a domain rule to obtain an error class, but it asserts the
  mapping, not the rule.
- The web package's feature-level integration tests (transactions, history,
  wallet lifecycle) are retired. The web session integration test and the web
  integration Vitest project remain until the Next.js adapter is removed.

### Authentication gateway for route tests

- A test `AuthGateway` in the server's testing directory resolves a test
  credential (a header or cookie value carrying a user id) to a session for a
  user created with the database package's `createTestUser`. `handleRequest`
  returns a not-found or method-not-allowed response, since the managed auth
  routes are not under test there.
- The integration app factory accepts an optional gateway; the default stays
  the real Better Auth gateway so `gateway.integration.test.ts` and the
  contract test keep exercising real auth. Route suites pass the test
  gateway.
- The existing sign-up-through-auth-routes helpers remain for the gateway
  integration test and any test whose subject is the managed auth routes.

### Diff, port, delete

- For each retired or trimmed test: list its scenarios (each distinct
  behaviour asserted, not each `test()`); find the application test covering
  the same scenario; port any scenario with no match into the application
  suite as an ordinary test; then delete the source test. Title similarity is
  not sufficient evidence of coverage — the assertion must exist.
- Route tests that both trigger a domain rule and assert the mapping are kept
  once per problem code and rewritten to assert the mapping only where they
  currently also assert rule details.

### File shape

- The application transaction suite is split per operation: create, update,
  delete, transfer, refund, reads (list/page/detail/defaults/summary). Test
  bodies move unchanged; shared fixtures move to the application testing
  directory if more than one file needs them.
- Route suites stay one file per routes module.

### Budget and documentation

- Budget: `pnpm test` wall time ≤ 60 s on the development machine, as
  Turborepo runs it (packages in parallel). Baseline ≈ 81 s.
- A "Test ownership" section in the code conventions states the ownership
  rule, the six route-suite responsibilities, the gateway-substitution
  convention for route integration tests, and the budget. Checked by hand;
  no CI timing gate.
- No ADR; `CONTEXT.md` unchanged.

## Testing Decisions

This effort is about tests, so "testing" here means how each ticket proves it
did no harm:

- Every ticket leaves every package green (`vitest run` per package, one
  package at a time).
- A good surviving test asserts external behaviour at its layer's seam:
  application tests call application functions and observe rows/results;
  route tests call `app.request()` and observe status, body shape and
  headers. Neither asserts implementation details of the other layer.
- Coverage-preservation evidence per diff/port/delete ticket: the scenario
  list with, for each scenario, the application test that covers it
  (existing or newly ported).
- Mutation probe at the end of the effort: change `MAX_NOTE_LENGTH` and
  confirm reds appear in the application suite, in at most one route test
  (the `invalid-command`/`bad-request` representative), and in the web form
  schema unit test — not in retired web integration tests. Revert.
- Budget probe at the end of the effort: time `pnpm test` three times; report
  the median; ≤ 60 s passes.
- Prior art: application integration tests under the application package
  using `setupTestDatabase().withRollback/committed`; server route tests
  using `createIntegrationTestApp` and `expectProblem`; the server unit app
  factory that already substitutes an `AuthGateway`
  (`anonymousAuthGateway`).

## Out of Scope

- Splitting multi-rule cluster tests into one rule per test.
- Extracting pure rules into the domain package for unit coverage
  (follow-up for `/improve-codebase-architecture`).
- Sharing or reusing Postgres containers across packages.
- Any change to the frozen Playwright E2E suite.
- Any change to production code beyond an optional gateway parameter on the
  integration app factory.
- Splitting `*.routes.ts` modules or their test files.
- A CI timing gate.
- The OpenAPI unit test's 1.6 s and the database package's own container.

## Further Notes

- Blocking order: the test gateway first — every later ticket measures its
  effect on the budget through it. Then per-feature diff/port/delete
  (transactions, wallets, categories, reports), then the conventions once the
  budget probe passes.
- Integration suites are memory-heavy; tickets must not run two packages'
  suites concurrently (see the local resource limits in `CLAUDE.md`).
- Measurements to compare against: server 209 tests / 80.8 s wall / 43.5 s
  test time; application 137 / 31.2 s / 9.4 s; web 90 / 25.7 s / 6.9 s.
