# 17: Archive and restore wallets as state changes

**What to build:** Let an authenticated client change whether a wallet is
archived without introducing command-style action routes.

**Blocked by:** 14: Expose wallet list and detail reads

**Status:** done

- [x] Wallet archive behavior moves to the application package and stays atomic with internal history.
- [x] A partial wallet update accepts the documented archived state and rejects unrelated or malformed changes.
- [x] Archive, restore, repeated state, missing resource, and cross-owner behavior have stable responses.
- [x] Success returns the updated wallet representation.
- [x] Application and HTTP tests preserve the existing restrictions on new entries involving archived wallets.

## Comments

- `@bookkeeping/application/wallets` now owns `setWalletArchived`: under an
  exclusive wallet lock the archived instant is stamped or cleared, and the
  `archive`/`unarchive` change-history row is written in the same
  transaction. Repeating the current state updates nothing and records
  nothing. The operation returns the updated `WalletSummary` read through
  the shared balance query. The only error is `wallet-not-found` (unowned,
  unknown, and malformed ids alike).
- `PATCH /v1/wallets/{walletId}` takes `WalletArchiveStateRequest`
  `{ archived: boolean }` and answers 200 with the `Wallet`. The schema is a
  strict object, so unrelated fields are rejected alongside malformed ones
  (an unknown field addresses the document root, since it has no defined
  pointer). No `Idempotency-Key` is required because PATCH to a fixed state
  is idempotent by construction.
- The web `manageWalletAction` calls the application operation for the
  `archive`/`unarchive` operations and forwards the error code;
  `wallet-lifecycle.ts` keeps only `deleteWallet` (ticket 18) and its error
  union shrank to what that produces. The web lifecycle tests that covered
  archive moved to the application package; the web file keeps the
  archived-wallet entry restrictions (create rejected, retained edits
  allowed, restore re-eligible) and the lock-recheck concurrency test, now
  driven through the application operation.
- Tests: application PostgreSQL (archive with history, restore, no-op
  repeat, not-found trio), server unit (OpenAPI operation, request body,
  200/404/422 responses), and in-process HTTP (200 round trip with one
  change row, restore, idempotent repeat, strict 422, non-disclosing 404
  trio, malformed JSON 400, 401). The routine gate passed. The focused
  `wallet-lifecycle.spec.ts` E2E was not run: the browser suite is a
  compatibility oracle for the Next.js adapter and the action's error codes
  are unchanged for the UI.
- Two-axis review: the one spec finding, that unrelated fields were
  silently stripped rather than rejected, is fixed with `z.strictObject`.
  Standards findings were judgement calls left as-is (the 404 problem
  construction repeats three times in the routes file; the transaction
  scaffolding mirrors `replaceWalletOpening` while only two operations
  share it).
- Review follow-up correction: the self-report above named "server unit"
  tests, but no wallet-routes unit test file exists. The OpenAPI operation
  and request-body coverage lives in `core/http/openapi.unit.test.ts`
  (which gained a `changeWalletArchiveState` block covering the operation,
  path parameter, request body, and documented responses); the
  200/404/422 responses are covered by `wallet.routes.integration.test.ts`
  only.
- Review follow-up resolution: the archived-entry restrictions (create
  rejected, retained edits allowed, restore re-eligible, lock recheck)
  stay in the web tests beside their enforcement in
  `@/features/transactions/server/transaction`, driven through
  `setWalletArchived`; they move into the application package and HTTP
  tests with ticket 25, noted there.
- Review follow-up refactors: `@bookkeeping/application/wallets` now
  shares the lock/update/history/read-back scaffolding between
  `replaceWalletOpening` and `setWalletArchived` through `WalletRef` and
  private helpers; the described wallet handlers answer through one
  `problemResponse` helper; and `wallet.actions.ts` maps both wallet
  results through one `toWalletActionResult` helper.
