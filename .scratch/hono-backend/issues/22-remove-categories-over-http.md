# 22: Remove categories with fallback behavior

**What to build:** Let an authenticated client remove eligible categories while
atomically preserving valid categorization for existing transactions.

**Blocked by:** 20: Create categories idempotently over HTTP; 21: Edit categories and inspect their usage

**Status:** resolved

- [x] Category removal moves to the application package with existing transaction and locking guarantees intact.
- [x] Child removal reassigns transactions to its parent; childless parent removal reassigns them to that tree's Uncategorized.
- [x] Protected, has-children, concurrent in-use, missing, and cross-owner outcomes map to stable Problem Details.
- [x] Successful removal returns `204` with no body or content type.
- [x] PostgreSQL concurrency tests and authenticated HTTP tests cover reassignment, rollback, and non-disclosure.

## Comments

- `removeCategory` moved verbatim from the Next.js feature into
  `@bookkeeping/application/categories` beside the update and usage operations:
  same one-transaction reassign-then-delete, same transaction-rows-before-
  category-row lock ordering, and the restrict foreign keys still have the
  final word (`has-children` / `in-use` from the FK violation, `in-use` being
  inherently concurrent — a statically in-use category reassigns by design,
  which the HTTP tests confirm). The web adapter's copy and its integration
  test were deleted; `category.actions.ts` and the history tests now import
  the shared operation.
- Hono exposes `DELETE /v1/categories/{categoryId}`: `204` with no body and
  no content type on success; `category-not-found` (missing, cross-owner,
  malformed) stays a non-disclosing `404`; `protected`, `has-children`, and
  concurrent `in-use` share one stable `409` `conflict` problem, matching the
  wallet-deletion precedent where every current-state blocker maps to one
  conflict code. Documented as a bodyless operation in the OpenAPI document.
- Application PostgreSQL coverage ports the removal suite to the shared
  fixtures: child → parent reassignment with a linked refund present, parent
  → Uncategorized once childless, the rejections of protected, foreign, and
  repeat removals, re-initialization not resurrecting removed defaults (all
  asserted within the parent-removal flow), and the concurrency races
  (removal vs child creation, removal vs transaction assignment, removal vs
  removal) asserting exactly one winner and rollback intact. The
  web suite's removal-vs-edit race returns with the transaction operations in
  ticket 28, which will lock transaction rows in the documented order.
- Full `pnpm run ci` passed (Biome, prettier, markdownlint, all typechecks,
  and every workspace suite: server 118, application, web 90, database).
