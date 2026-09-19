# Test suite health — decisions

Settled 2026-09-19 by interview, from the measurements in `facts.md`. Input
for `/to-spec`.

## Ownership

- **D1.** `packages/application` is the sole owner of business-rule coverage. Other
  layers may use a rule inside a fixture; they never assert it.
- **D2.** The server route suite (`apps/server/**/*.routes.integration.test.ts`)
  covers exactly:
  - status code and problem-details mapping — one representative per
    error class, not per rule
  - request validation → field-error mapping
  - auth, session and ownership enforcement at the boundary
  - response serialization against the Zod response schemas (money as
    decimal string, cursor pagination shape)
  - idempotency-key HTTP semantics (header handling, key consumption on
    failure)
  - one happy-path round trip per endpoint

  Domain rules exercised through HTTP are out of scope.

- **D3.** `apps/web/src/features/**/server/*.integration.test.ts` (transaction,
  history, wallet-lifecycle) are retired: diff each scenario against the
  application suite, port anything unique, then delete.
  `apps/web/src/core/auth/session.integration.test.ts` stays as-is, and the
  web integration Vitest project stays until the Next.js adapter is removed.
- **D4.** Route tests that re-prove domain rules get the same treatment: diff, port
  anything unique to application, delete — keeping exactly one representative
  per error class in the route suite.

## Cost

- **D5.** Budget: `pnpm test` (turbo-parallel, as `turbo.json` runs it) wall time
  ≤ 60 s on the development machine. Baseline ≈ 81 s, bottlenecked by
  `apps/server`. Documented in `docs/code-conventions.md`; checked by hand.
  No CI timing gate.
- **D6.** Route integration tests obtain owners through a test `AuthGateway`
  (`apps/server/src/testing/`) whose `resolveSession` maps a test credential
  to a `createTestUser` row. Real Better Auth over HTTP remains covered only
  by `apps/server/src/core/auth/gateway.integration.test.ts`.
- **D7.** Per-package Testcontainers Postgres stays. Revisit sharing or reuse only
  if 5–6 miss the budget.

## Shape

- **D8.** The application transaction suite splits per operation (create, update,
  delete, transfer, refund, reads) while porting; test bodies are unchanged.
  Route suites shrink but remain one file per `*.routes.ts` (stem rule).
- **D9.** Out of scope, recorded as follow-ups:
  - splitting multi-rule cluster tests into one rule per test
  - extracting pure rules into `packages/domain` for unit coverage
    (candidate for `/improve-codebase-architecture`)

## Docs

- **D10.** Outcome is a "Test ownership" section in `docs/code-conventions.md`.
  No ADR (reversible; rationale is short). `CONTEXT.md` untouched — no
  domain vocabulary changed.

## Execution notes

- Multi-session: `/to-spec` → `/to-tickets` → `/implement` per ticket.
- Integration suites are heavy: tickets run one package's suite at a time,
  per the local resource limits in `CLAUDE.md`.
- Suggested blocking order: test gateway (6) first — it unblocks measuring
  the route-suite changes; then per-feature diff/port/delete (3, 4, 8); then
  conventions (5, 10) once the budget is confirmed met.
