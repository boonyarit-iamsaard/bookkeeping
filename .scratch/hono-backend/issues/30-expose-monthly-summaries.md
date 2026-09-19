# 30: Expose monthly financial summaries

**What to build:** Let an authenticated client retrieve server-calculated
monthly totals without reproducing financial rules in the client.

**Blocked by:** 24: List transactions with filters and opaque cursors; 29: Delete transactions over HTTP

**Status:** resolved

- [x] Monthly summary behavior moves to the application package with Bangkok calendar boundaries intact.
- [x] The versioned report resource returns income, gross expenses, refunds, net expenses, and net as canonical Money objects.
- [x] Transfers and opening balances remain excluded and refunds count in their transaction month.
- [x] Invalid months, unauthenticated requests, empty months, and large exact aggregates have documented responses.
- [x] PostgreSQL, runtime-schema, OpenAPI, and HTTP tests verify the report contract.

## Answer

`getMonthlySummary` moved verbatim from the web adapter into
`@bookkeeping/application/transactions` beside the other transaction reads
(`packages/application/src/transactions/transaction.ts`), returning the
existing domain `MonthlySummary` (exact satang bigints plus transaction
count). The web copy was deleted; the dashboard Server Component and the web
adapter's integration tests now call the application operation directly, so
both backends keep one financial implementation. Month boundaries stay pure
calendar arithmetic over date strings, and refunds count in their own
transaction month while transfers and opening balances never count.

The HTTP report resource is a new Reports feature:

- `GET /v1/reports/monthly?month=YYYY-MM` (`getMonthlyReport`) returns
  `month`, `income`, `grossExpenses`, `refunds`, `netExpenses`, and `net` as
  canonical `{ value, currency }` Money objects (negative values legal for
  `netExpenses`/`net`) beside `transactionCount`, documented as the
  `MonthlyReport` schema. The query follows the collection-query precedent:
  `strictObject` over the shared month grammar (real YYYY-MM from 0001-01,
  matching the web's report schema), and a malformed or impossible month is a
  generic 400 `bad-request`, with 401 `unauthenticated` documented and
  enforced by the shared session middleware. An empty month answers 200 with
  every amount zero and `transactionCount: 0`, and aggregates carry the exact
  decimal string past JavaScript's safe integers.
- Tests: the application package's PostgreSQL integration suite proves the
  moved behavior (own-month refunds across month boundaries, exact
  aggregates, transfer exclusion, correction/deletion follow-through,
  foreign-owner zeros); `report.routes.unit.test.ts` covers the runtime query
  and response schemas; `report.routes.integration.test.ts` covers canonical
  money totals, own-month refunds, deleted-transaction exclusion, empty and
  foreign months, exact large aggregates, 400, and 401; the OpenAPI test
  documents the operation, its required `month` parameter, the `MonthlyReport`
  component, and its problem responses.

Static checks and the workspace test suites pass; the temporary Next.js
adapter keeps its parity tests green over the shared operation.
