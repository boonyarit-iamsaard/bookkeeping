# 31: Complete the API-parity and workspace gate

**What to build:** Close the initiative by proving that Hono covers every
current user-visible backend behavior and that the extracted workspace has no
temporary ownership leaks.

**Blocked by:** 12: Retry interrupted fresh-user provisioning; 15: Create wallets idempotently over HTTP; 16: Replace a wallet opening balance; 17: Archive and restore wallets as state changes; 18: Delete eligible wallets over HTTP; 19: Expose category trees as read-only resources; 20: Create categories idempotently over HTTP; 21: Edit categories and inspect their usage; 22: Remove categories with fallback behavior; 23: Expose transaction detail and supporting reads; 24: List transactions with filters and opaque cursors; 25: Create income and expenses idempotently; 26: Create wallet transfers over HTTP; 27: Create linked refunds over HTTP; 28: Update transactions over HTTP; 29: Delete transactions over HTTP; 30: Expose monthly financial summaries

**Status:** resolved

- [x] A behavior inventory maps every current user-visible backend flow to a tested Hono operation or an explicit out-of-scope decision.
- [x] OpenAPI generation and response-schema contract tests cover every published operation and Problem Details variant.
- [x] Temporary forwarding exports are removed after all consumers use package public subpaths; no business operation has duplicate ownership.
- [x] Root scripts, Turbo tasks and outputs, environment examples, CI, static-analysis scope, and contributor documentation reflect both apps and all packages.
- [x] Formatting, linting, type checks, package tests, PostgreSQL integration tests, both app builds, Hono contract tests, and the retained Next.js browser suite pass in a resource-safe sequence.
- [x] Next.js remains a working temporary adapter; no SPA migration or Next.js removal is included.

## Answer

The behavior inventory is `docs/api-parity.md`. It walks every Server
Component read, Server Action, and auth flow the Next.js adapter offers and
names the Hono operation covering it, the test file proving it, and six
differences that are deliberate rather than missing. The audit found two real
gaps, both closed here:

- `GET /v1/wallets` now accepts an optional `asOf` calendar date, the
  dashboard's as-of balance picker. Ticket 14 deferred this parameter
  explicitly to "ticket 30/31 to place". A date before a wallet opened
  reports zero, a malformed date or unknown parameter is a `400`, and the
  documented parameter is asserted in the OpenAPI test.
- `GET /v1/categories/usage` (`listCategoryUsage`) returns transaction counts
  for the whole tree in one read, which the categories management page's
  per-category entry counts need. Ticket 21 had left `listCategoryUsage` as a
  Next.js-only read. It is registered before the identifier route so the
  static path is never captured, returns only categories holding at least one
  current transaction, and never counts refunds or deleted rows.

Contract coverage can no longer drift from the document.
`core/http/api-contract.integration.test.ts` drives all 23 published
operations (22 resource operations plus `getHealth`) over HTTP against real PostgreSQL, checks each response against
the schema the generated document names for it (including bodyless `204`s and
a JSON round-trip that would catch a leaked `bigint` or `Date`), and fails if
the exercised operation set differs from the published set — so a new route
cannot ship without contract coverage. A second test answers every Problem
Details code the API produces and checks each against its documented variant,
asserting the produced set equals `problemCodes` minus four explicitly
reserved transport mappings. `core/http/problem-details.unit.test.ts` is new
and covers all twelve codes, the optional members, and JSON Pointer field
errors.

Ownership leaks removed: `apps/web/src/features/transactions/server/transaction.ts`
(a wrapper that only renamed `idempotencyKey` to `submissionKey` and
`idempotency-conflict` to `submission-conflict`; its only remaining consumers
were three test files, since `transaction.actions.ts` already called the
application operation) and `apps/web/src/features/transactions/money-limits.ts`
(a pure re-export of three domain constants). Both consumers now import the
package subpaths directly. `submissionKey` stays as web _form_ vocabulary,
which wallets and categories also use.

Workspace: `pnpm run ci` now runs the builds as a separate step after the
suites, so a production build never runs beside the test suites; `start`,
`start:web`, `start:server`, and `test:watch` became Turborepo tasks covering
both apps rather than web-only scripts; `start` depends on `build`. The CI
workflow records why only the web app needs a `.env`. README corrected: the
stale `core/database/schema/` and `tests/database/` trees, the missing
transactions/reports server features, the missing application transactions
subpath, and the `${PORT:-4000}` claim the web `start` script no longer makes.

Gates all green: Biome, Prettier, markdownlint, 7 type-check tasks, domain
25, database 2, auth 6, application 137, web 90, server 207 (contract tests
included), then each app build. `pnpm run ci` passes as a whole.

The retained Next.js browser suite (`pnpm run ci:e2e`) was run alone as the
final gate, after every other suite and build: production build, then 42
Playwright tests, 42 passed in 8.6 minutes.
