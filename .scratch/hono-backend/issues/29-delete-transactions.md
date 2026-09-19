# 29: Delete transactions over HTTP

**What to build:** Let an authenticated client remove a mistaken transaction
from normal financial history while retaining the established internal record.

**Blocked by:** 28: Update transactions over HTTP

**Status:** resolved

- [x] Transaction deletion moves to the application package and writes internal history atomically with the soft deletion.
- [x] Deleting income, expenses, transfers, and refunds removes their current financial effects correctly.
- [x] Expenses with refunds remain protected by a stable conflict problem.
- [x] Eligible deletion returns `204`; repeat, missing, unauthenticated, and cross-owner requests follow the documented non-disclosing contract.
- [x] PostgreSQL and HTTP tests verify balances, history, linked constraints, rollback, and response semantics.

## Answer

`deleteTransaction` now lives in `@bookkeeping/application/transactions`
beside the other transaction operations, reusing the shared `TransactionRef`,
row lock, snapshot builder, refund reader, and history writer — the web
adapter's local copy, lock, and history write were deleted rather than ported:

- The temporary Next.js adapter keeps only the create wrapper;
  `deleteTransactionAction` calls the application operation and maps the
  same two rejections (`transaction-not-found`, `refunds-exist`) as before.
  The web operation tests now call the application function directly.
- `DELETE /v1/transactions/{transactionId}` requires an authenticated
  session and a uuid path identifier (malformed is 404 alike). An eligible
  deletion answers an empty `204` with no `Content-Type`; a repeat is the
  same outcome without new history, so a lost-response retry is safe.
  `transaction-not-found` (unknown, foreign, malformed alike) is 404, an
  expense that still has linked refunds is 409 `conflict`, and
  unauthenticated requests are 401 — all documented in the OpenAPI
  description and asserted against Problem Details.
- Application tests (`transaction.integration.test.ts`) cover income,
  expense, transfer, and refund deletions clearing lists, detail, and
  end-of-day balances with one atomic `delete` history entry, the idempotent
  repeat, the late create retry that replays the original outcome without
  recreating, the `refunds-exist` guard and the refunds that free the
  expense once removed, an injected history-write fault that rolls the soft
  deletion back, owner isolation, and committed races where a refund
  deletion/reduction or an expense deletion/refund creation serialize on
  the locked expense row.
- HTTP tests cover the 204 semantics (no body, no content type, reads not
  found, balance restored, one history entry), the 409 for an expense with
  refunds through the boundary, non-disclosing 404s, and 401; the OpenAPI
  test covers the `deleteTransaction` operation's path parameter, bodyless
  204, and Problem Details responses.

Static checks, all package and app tests (PostgreSQL-backed integration
suites included), and the workspace-wide `turbo run test` pass; one
unrelated categories HTTP test timed out once under full-suite load and
passed on rerun.
