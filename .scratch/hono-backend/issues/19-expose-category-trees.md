# 19: Expose category trees as read-only resources

**What to build:** Let an authenticated client retrieve its income and expense
category trees without reads creating or modifying defaults.

**Blocked by:** 12: Retry interrupted fresh-user provisioning; 15: Create wallets idempotently over HTTP; 16: Replace a wallet opening balance; 17: Archive and restore wallets as state changes; 18: Delete eligible wallets over HTTP

**Status:** done

- [x] Category query behavior moves to the application package and remains shared with Next.js.
- [x] Versioned category reads return owned parent/child trees and protected-category metadata without pagination.
- [x] Reads are side-effect free even when provisioning is incomplete.
- [x] Session ownership, unauthenticated rejection, runtime schemas, and OpenAPI are verified through HTTP tests.
- [x] Existing ordering and selection behavior remains unchanged.

## Comments

- `listCategories` now lives in `@bookkeeping/application/categories` with the
  existing owner filter and deterministic picker ordering. Next.js pages and
  integration fixtures import that shared operation directly; category writes
  remain in the web adapter until their later tickets.
- Hono exposes `GET /v1/categories` as an authenticated, unpaginated
  `{ items, page: { nextCursor: null } }` collection. Each item carries its
  parent id, kind, icon, and protected metadata. The route only lists rows and
  does not call provisioning, so incomplete owners remain unchanged.
- Runtime response schemas, generated OpenAPI coverage, authenticated and
  anonymous HTTP tests, ownership isolation, ordering, and incomplete-read
  behavior were added. Focused unit tests and workspace typechecks pass.
  The full `pnpm test` command was attempted but PostgreSQL-backed suites
  could not start because this environment has no usable Docker/Testcontainers
  runtime.
