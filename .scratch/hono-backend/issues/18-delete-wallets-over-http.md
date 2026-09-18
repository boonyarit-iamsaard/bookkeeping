# 18: Delete eligible wallets over HTTP

**What to build:** Let an authenticated client permanently remove only wallets
whose current and retained history permits deletion.

**Blocked by:** 14: Expose wallet list and detail reads

**Status:** done

- [x] Wallet deletion moves to the application package without weakening retained-history checks.
- [x] Eligible deletion returns `204` with no body or content type.
- [x] Current transactions, wallet changes, and retained transaction snapshots prevent deletion through a stable conflict problem.
- [x] Missing and cross-owner resources remain non-disclosing.
- [x] PostgreSQL and HTTP tests cover eligible, blocked, repeated, unauthenticated, and cross-owner requests.

## Comments

- From ticket 17's review: `apps/web/src/features/wallets/server/wallet-lifecycle.ts`
  keeps only `deleteWallet`, and its `ManageWalletInput` and `lockWallet`
  now duplicate `WalletRef` and `loadWalletForUpdate` in
  `@bookkeeping/application/wallets`. Moving deletion into the application
  package should reuse those and delete the web file rather than port the
  copies.
- `@bookkeeping/application/wallets` now owns `deleteWallet`, reusing the
  shared wallet reference and row lock. It rejects current transactions,
  wallet changes, and wallet ids retained in transaction snapshots, while
  treating unknown, foreign, and malformed ids alike.
- `DELETE /v1/wallets/{walletId}` returns an empty `204` on success, a stable
  `409` conflict problem when history remains, and non-disclosing `404` or
  `401` problems for the other cases. The web lifecycle module was removed
  and the existing server action now calls the application operation.
- Application and HTTP regression tests cover eligible, repeated, blocked,
  unauthenticated, cross-owner, and retained-snapshot cases. Focused unit
  tests and all static CI checks pass. The full test phase could not start its
  PostgreSQL-backed projects because this environment has no usable
  Testcontainers runtime.
