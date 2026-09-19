# 23: Expose transaction detail and supporting reads

**What to build:** Give authenticated clients the transaction detail and
server-calculated supporting information required by create, edit, and refund
flows.

**Blocked by:** 22: Remove categories with fallback behavior; 11: Mount Better Auth and authenticated context in Hono

**Status:** resolved

- [x] Transaction detail, refund allowance, and entry-default queries move to feature subpaths in the application package.
- [x] Detail responses map money, transaction dates, recording instants, wallets, categories, destinations, and refund links explicitly.
- [x] Supporting reads provide current owned choices and calculations without exposing internal change history.
- [x] Missing and cross-owner transaction identifiers are non-disclosing.
- [x] Runtime schemas, OpenAPI, PostgreSQL tests, and authenticated/unauthenticated HTTP tests cover the reads.

## Comments

- `findTransaction`, `findExpenseRefunds`, and `findLastUsedWalletId` moved
  verbatim from the Next.js feature into
  `@bookkeeping/application/transactions` (new subpath export beside
  `./wallets` and `./categories`), with `undefined`-returns normalized to
  `null` and `isUuid` guards so a malformed identifier reads as not found
  without reaching the database. The web copies, their private detail
  projection, and the three table aliases were deleted; the pages and the
  transaction, history, and wallet-lifecycle suites now import the shared
  reads. `listTransactions` moved with them because it shares the same
  detail projection; ticket 24 adds cursor pagination on top of it.
- `findReplayedTransaction` joined the application package as the one
  deliberate addition: the create flow's idempotent replay must read back
  the receipt's record even after deletion, which `findTransaction`'s
  deleted filter would break, and duplicating the projection in the web app
  to preserve that was worse. It is a read-back primitive, not a normal
  view; ticket 25 absorbs it when `createTransaction` itself moves.
- Hono exposes the reads under the authenticated `/v1` router:
  `GET /v1/transactions/{transactionId}` returns the exact money/date/
  instant/wallet/category/destination/refund mapping;
  `GET /v1/transactions/{transactionId}/refunds` returns the current
  refunds, their exact total, and the remainder clamped at zero;
  `GET /v1/transactions/entry-defaults` returns the last-used wallet.
  Missing, cross-owner, malformed, and deleted identifiers share one
  non-disclosing `404` `not-found` problem, and the refunds allowance is
  `404` for anything that is not a current owned expense. No response
  carries the internal change history. Schemas carry meta ids
  (`Transaction`, `TransactionRefunds`, `TransactionEntryDefaults`) and the
  OpenAPI document test asserts the paths, `$ref`s, and problem responses.
- Application PostgreSQL coverage covers the mapping (expense tree,
  transfer destination, refund's expense link following its expense's
  current category through a removal fallback), the allowance arithmetic
  with deleted refunds excluded, the replay read-back of a deleted record,
  and every not-found shape. HTTP tests cover the three reads
  authenticated plus a 401 sweep unauthenticated.
- Two-axis review (standards + spec) found no violations; its judgement
  calls were declined with cause: the replay twin is the pre-agreed seam
  until ticket 25, and the per-file test fixtures match existing practice.
- Full `pnpm run ci` passed (Biome, prettier, markdownlint, all typechecks,
  and every workspace suite; excludes browser tests by design).
