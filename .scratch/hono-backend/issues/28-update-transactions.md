# 28: Update transactions over HTTP

**What to build:** Let an authenticated client correct an existing transaction
without changing its type or violating linked financial history.

**Blocked by:** 27: Create linked refunds over HTTP

**Status:** resolved

- [x] Transaction update behavior and internal history ownership move to the application package.
- [x] Updates preserve type and validate exact money, dates, wallets, categories, transfer shape, refund links, and archived-resource retention rules.
- [x] Expense and refund changes preserve combined refund amounts and linked date constraints under concurrency.
- [x] Success returns the updated transaction detail; missing and cross-owner resources remain non-disclosing.
- [x] PostgreSQL and HTTP tests cover every transaction type, no-op update, rollback, history, conflicts, and invalid input.

## Comments

- From ticket 17's review: the retained-edits-on-archived-wallet cases
  currently live in the web wallet-lifecycle tests (see tickets 17 and
  25); when this ticket moves transaction updates into the application
  package, those cases move into application and HTTP tests with it.

## Answer

`updateTransaction` now lives in `@bookkeeping/application/transactions`
beside creation, sharing its validation and locking scaffolding, so the
web adapter and the Hono server both delegate to one owner:

- The web adapter keeps only the create wrapper and `deleteTransaction`
  (ticket 29); its local update, history write, and history read are
  deleted, and `updateTransactionAction` calls the application operation.
  The web tests call the application function directly, and the
  wallet-lifecycle archive test dropped its retained-edit assertions in
  favour of the new application and HTTP cases.
- `PUT /v1/transactions/{transactionId}` takes a strict
  `UpdateTransactionRequest` (money, wallet, optional category and
  destination, calendar date, note) and needs no idempotency key: the
  update is fixed-state and repeats safely. `transaction-not-found`
  (unknown, foreign, deleted, malformed alike) is 404; other rejections
  are 422 field errors — the shared pointers with creation, except the
  fixed-type contradictions (`invalid-transfer`, `invalid-refund`,
  `expense-not-found`) which address the document root because the
  request names no type or refund link.
- Application tests (`transaction.integration.test.ts`) cover expense,
  transfer, and refund edits with retained archived wallets, no-op
  edits, rejection rollbacks, before/after change history, the
  `editingRefundId` exclusion, expense guards under linked refunds,
  serialization of concurrent edits, and an injected history-write fault
  that rolls the financial update back.
- HTTP tests cover the same behavior through the boundary for every
  type, plus Problem Details pointers, non-disclosing 404s, 401, and
  malformed JSON; runtime-schema and OpenAPI tests cover the
  `UpdateTransactionRequest` schema and the documented update operation.
