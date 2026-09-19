# Test suite health — facts

Gathered 2026-09-19 on `main` @ 27c465f. Input for `/grill-with-docs`; no
decisions here, only measurements.

## 1. Cost

Each package runs `vitest run`, sequentially (per local resource limits).
Integration projects use `fileParallelism: false` and a Testcontainers Postgres
per package via `@bookkeeping/database/testing/global-setup`.

| Package                |   Tests |      Wall | Sum of file time | Overhead (container + transform) |
| ---------------------- | ------: | --------: | ---------------: | -------------------------------: |
| `packages/application` |     137 |    31.2 s |            9.4 s |                            ~22 s |
| `apps/server`          |     209 |    80.8 s |           43.5 s |                            ~37 s |
| `apps/web`             |      90 |    25.7 s |            6.9 s |                            ~19 s |
| `packages/database`    |       2 |    10.6 s |            0.2 s |                            ~10 s |
| **Total**              | **438** | **148 s** |         **60 s** |                        **~88 s** |

Roughly 60% of wall time is fixed overhead: four independent Postgres containers
started per `pnpm test`, one per package.

### Slowest files

| File                                                       | Tests |   Time |            ms/test |
| ---------------------------------------------------------- | ----: | -----: | -----------------: |
| `apps/server/.../transaction.routes.integration.test.ts`   |    42 | 16.7 s |                397 |
| `apps/server/.../wallet.routes.integration.test.ts`        |    39 | 10.6 s |                272 |
| `apps/server/.../category.routes.integration.test.ts`      |    35 |  9.5 s |                271 |
| `packages/application/.../transaction.integration.test.ts` |    51 |  5.2 s |                102 |
| `apps/web/.../server/transaction.integration.test.ts`      |    33 |  4.5 s |                138 |
| `packages/application/.../category.integration.test.ts`    |    32 |  2.8 s |                 88 |
| `apps/server/.../report.routes.integration.test.ts`        |     5 |  2.0 s |                407 |
| `apps/server/src/core/http/openapi.unit.test.ts`           |    17 |  1.6 s | 94 (a _unit_ file) |

### Why server tests cost ~3–4× per test

Every server route test provisions its owner through
`signUpWithSession` → real Better Auth `POST /api/auth/sign-up/email`
(password hashing) + `GET /api/auth/get-session`. The transaction suite calls
this 50 times, wallets 39, categories 38. Application tests use
`createTestUser` (a direct row insert) instead.

## 2. Layer duplication

The same features are integration-tested against a real database at three layers:

| Feature      | `packages/application` | `apps/server` (HTTP) |       `apps/web` |
| ------------ | ---------------------: | -------------------: | ---------------: |
| transactions |                     51 |                   42 | 33 + 4 (history) |
| categories   |                     32 |                   35 |                0 |
| wallets      |                     31 |                   39 |                5 |

### `apps/web` integration tests exercise no web code

`apps/web/src/features/*/server/*.integration.test.ts` import
`createTransaction`, `updateTransaction`, … directly from
`@bookkeeping/application/*`. Their only `@/` import is a test fixture
(`@/testing/wallet-fixture`). They do not touch `transaction.actions.ts` or any
Next.js boundary. Git history: the application suite was built by porting these
behaviours ticket-by-ticket during the Hono migration
(`0674d37`, `bf1a46a`, `89367ec`, `509997d`, `27ed99a`); the web originals were
never retired. `apps/web/src/core/auth/session.integration.test.ts` is the one
web integration file that tests web code.

### Title-similarity overlap (Jaccard on test titles, rough proxy)

| Layer vs application     | strong ≥0.5 | partial | layer-specific |
| ------------------------ | ----------: | ------: | -------------: |
| server transactions (42) |          11 |      13 |             18 |
| web transactions (33)    |           6 |       8 |            19* |
| server categories (35)   |           6 |       4 |             25 |
| server wallets (39)      |           8 |       8 |             23 |

\* Title-matching undercounts the web suite: since it calls only application
functions, every one of its tests is by construction an application-layer test
regardless of title. Full lists in the session scratchpad (`overlap.md`).

Sample server titles that are genuinely HTTP-layer concerns (keep-worthy):
"does not consume a key after application validation and maps field failures",
"maps invalid update input to field errors". Sample server titles that re-prove
domain rules through HTTP: refund limits, transfer date rules, archived-wallet
rejection, idempotency replay semantics.

## 3. Mutation check

Changed `MAX_NOTE_LENGTH` 200 → 2000 in `packages/domain`, ran all suites,
reverted.

| Layer       | Failing tests                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------- |
| application | 2 (`rejects invalid dates, bounded values…`, `rejected edits change nothing…`)                      |
| server      | 2 (`…maps field failures`, `maps invalid update input to field errors`)                             |
| web         | 3 (form-schema unit ×1, `a note over 200 characters is rejected`, `rejected edits change nothing…`) |

One rule → 7 red tests across 3 packages; 5 of them assert the same thing.
The web integration failures duplicate the application ones verbatim.

## 4. Structural notes

- Integration tests hold whole features in one file: 3173 / 2983 / 2099 LoC
  for transactions alone. Many single `test()` blocks assert 4–6 behaviours
  ("…rejects same wallets, foreign wallets, missing currency, and dates outside
  either wallet"), so a failure names a cluster, not a rule.
- No test tier exists between "pure unit" and "real Postgres": application
  rules (date bounds, note length, category-tree membership, refund caps) are
  only checked through the database.
- The Next.js Playwright suite is frozen as a migration oracle per
  ADR 0003 and is not counted here.

## Open questions for the interview

1. Which layer owns business-rule coverage — and does anything else get to
   re-assert it?
2. What is the server route suite _for_: status codes, problem-details
   mapping, auth, serialization, OpenAPI contract? Can it seed owners via
   `createTestUser` + a signed session instead of a real sign-up?
3. Do `apps/web/**/server/*.integration.test.ts` have any purpose left, given
   they test `@bookkeeping/application` and the adapter is temporary?
4. Should the four packages share one Postgres container per `pnpm test`, or
   is per-package isolation worth ~60 s?
5. Is there a local time budget (e.g. "routine gate under 60 s")?
