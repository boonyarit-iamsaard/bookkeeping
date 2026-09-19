# 27: Create linked refunds over HTTP

**What to build:** Extend transaction creation so an authenticated client can
record a full or partial refund linked to an owned expense.

**Blocked by:** 26: Create wallet transfers over HTTP

**Status:** resolved

- [x] The request contract accepts refunds only through an owned expense link and an owned active receiving wallet.
- [x] The server enforces expense/refund dates, wallet opening, remaining refundable amount, inherited category, and positive exact money.
- [x] Concurrent refunds cannot exceed the expense, and retry behavior remains idempotent.
- [x] Success returns complete refund detail including its expense link.
- [x] Application and HTTP tests cover full, partial, alternate-wallet, archived-wallet, limit, date, concurrent, and cross-owner cases.

## Comments

- From ticket 17's review: the archived-wallet restriction tests currently
  live in the web transaction module (see tickets 17 and 25); when this
  ticket moves refund creation into the application package, its
  archived-wallet cases move into application and HTTP tests with it.

## Answer

Refund creation already moved to `@bookkeeping/application/transactions`
with ticket 25, so this ticket added the HTTP boundary and the moved tests:

- `createTransactionRequestSchema` gained a `refund` branch requiring
  `refundOfTransactionId` and rejecting `categoryId`; `expense-not-found`
  maps to `#/refundOfTransactionId`.
- Application tests (`transaction.integration.test.ts`) cover full and
  partial refunds, alternate receiving wallets, the refundable limit,
  before-expense and before-opening dates, archived receiving wallets,
  deleted/foreign/non-expense links, replay, and both concurrency shapes
  (one key replays; distinct keys cannot exceed the expense).
- HTTP tests (`transaction.routes.integration.test.ts`) cover the same
  cases plus Problem Details pointers and the key-not-consumed guarantee;
  runtime-schema and OpenAPI tests cover the third request branch.
