# 14: Expose wallet list and detail reads

**What to build:** Let an authenticated API client retrieve its wallet
collection and an individual wallet using the same balance behavior as the
existing UI.

**Blocked by:** 11: Mount Better Auth and authenticated context in Hono; 08: Extract the PostgreSQL database boundary; 06: Extract exact values and wallet vocabulary

**Status:** done

- [x] Wallet read operations and their PostgreSQL tests move to the application package without changing the Next.js UI.
- [x] Versioned collection and individual resource routes derive ownership only from the session.
- [x] Money responses use exact major-unit decimal strings with explicit THB currency.
- [x] Missing and cross-owner wallet identifiers return the same non-disclosing not-found problem.
- [x] Runtime schemas, OpenAPI, and authenticated/unauthenticated HTTP tests cover both routes.

## Comments

- Added `@bookkeeping/application/wallets` with `listWallets` (moved verbatim
  from the web app, `asOf` retained for the dashboard) and a new `findWallet`
  that shares the same balance query and returns `null` for a missing,
  cross-owner, or non-uuid id, so the Next.js detail page no longer scans the
  whole list and a typed `/wallets/abc` stays a 404 rather than a PostgreSQL
  fault. The web `wallet.ts` keeps only `createWallet` until ticket 15; its
  listing tests moved to the application package, which inserts wallet rows
  directly as fixtures until creation moves there.
- Added `core/http/money.ts`: `moneySchema` (`{ value, currency }`,
  `Currency` enum) and `presentMoney`, which reuses the domain's
  `formatMoneyInput` so satang become `"125.50"` without touching `number`;
  a unit test covers negatives and values beyond 2^53.
- `features/wallets/wallet.routes.ts` mounts `GET /v1/wallets`
  (`{ items, page: { nextCursor: null } }`) and `GET /v1/wallets/:walletId`
  under the session requirement. The path parameter is validated as a uuid
  through `hono-openapi`'s `validator`, whose hook answers the standard 404
  problem, and the handler answers the same 404 for an unowned id. `archivedAt`
  is a UTC RFC 3339 instant; `openingDate` stays a calendar date.
- `ProblemDetails.errors` became a fresh mutable array: `describeResponse`
  types the handler against the schema's JSON output, and the 404 body had to
  be one of the documented responses rather than an untyped `Response`.
- Tests: application PostgreSQL tests for both reads (ownership, ordering,
  future openings, exact large and negative balances, cross-owner and
  malformed ids); in-process Hono tests for authenticated success, empty and
  cross-owner collections, archived detail, non-disclosing 404s, and 401s; the
  OpenAPI unit test pins both operations, the path parameter, and the
  `Wallet`/`WalletCollection`/`Money`/`Currency` components. No `asOf` query
  parameter is exposed yet; the dashboard's as-of balances remain a Next.js
  read for ticket 30/31 to place.
- The routine gate passed with Biome scoped to `apps packages` because a
  stray `.kilo/worktrees/` checkout (untracked, from another tool) makes root
  `biome ci .` reject a nested configuration.
