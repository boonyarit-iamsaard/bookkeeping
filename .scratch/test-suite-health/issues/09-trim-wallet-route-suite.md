# 09: Trim the wallet route suite to HTTP scope

**What to build:** `apps/server/src/features/wallets/wallet.routes.integration.test.ts` (39 tests)
asserts only what the route layer owns. Tests that re-prove domain rules are
shown to be covered by the application suite (ported if not) and removed,
keeping exactly one representative per problem code per endpoint.

**Blocked by:** 02 (Migrate wallet route suite), 08 (Retire web wallet-lifecycle test)

**Status:** resolved

## Ground rules (every ticket in this effort)

- Read `../spec.md` and `../decisions.md` first. Do only what this ticket says.
- Never touch: `apps/web/tests/e2e/**`, `CONTEXT.md`, `docs/adr/**`, anything under
  `packages/database/src/**` except test helpers already named in this ticket,
  database migrations, `turbo.json`, any `vitest.config.mts`.
- Never change production code unless this ticket names the exact file.
- Never change an assertion in a kept test unless this ticket says to.
- Run test suites for ONE package at a time, never two concurrently
  (memory limit, see `CLAUDE.md`). Never run Playwright or Sonar.
- When done, append a `## Comments` entry to this file: what you ran, the
  test counts before/after, anything you were unsure about. Do not mark the
  checkboxes yourself; the reviewer does.
- If any "Stop and ask" trigger fires, write the question under `## Comments`
  and stop. Do not guess.

## What the route suite owns (from `../spec.md`)

R1. Status code + problem-details mapping — ONE test per problem code the
endpoint can emit (`bad-request`, `conflict`, `forbidden`,
`idempotency-conflict`, `idempotency-key-required`, `invalid-command`,
`not-found`, `unauthenticated`, as applicable).
R2. Request validation → field-error mapping (per body-accepting endpoint).
R3. Authentication / ownership enforcement at the boundary (anonymous → 401;
another owner's resource → whatever the route returns today).
R4. Response serialization against the exported Zod response schemas.
R5. Idempotency-key HTTP semantics (header required, replay, conflict, key
not consumed on application-level rejection).
R6. One happy-path round trip per endpoint.
D. Domain rule proven through HTTP — NOT owned here.

## Steps

1. **Classification table first.** Before editing, append under
   `## Comments` one row per existing test:
   `| describe | test title | class (R1–R6 or D) | problem code if R1 | keep / delete / keep-trimmed | covering application test if D |`.
   Rules:
   - A test is R1 only if it is the FIRST test in its endpoint's describe for
     that problem code; later tests for the same code are D.
   - A test that asserts both a mapping and rule details (e.g. the exact
     refund cap arithmetic in the body) is `keep-trimmed`: keep the request
     and the status/problem-code assertion, delete rule-detail assertions.
   - Everything classified D must name a covering application test in
     `packages/application/src/wallets/wallet.integration.test.ts`, or be marked PORT.
2. **Port** every PORT row into the application suite (copy body, adapt
   imports/fixtures, keep title).
3. **Delete** every `delete` row. **Trim** every `keep-trimmed` row as
   described — remove assertions only, never add or rewrite.
4. Remove helpers and imports that became unused.

## Verify

- `pnpm --filter @bookkeeping/application exec vitest run` passes; record
  count.
- `pnpm --filter @bookkeeping/server exec vitest run` passes; record count
  and this file's duration from the JSON reporter.
- Every endpoint describe still has ≥1 R6 test and ≥1 test per problem code
  it can emit (state this explicitly in Comments per endpoint).
- `pnpm --filter @bookkeeping/server types:check`,
  `pnpm --filter @bookkeeping/application types:check`, `pnpm lint` pass.

## Stop and ask

- You cannot tell which problem code an endpoint emits for a case (look at
  the routes module and `apps/server/src/core/http/problem-details.ts`
  first; ask only if still unclear).
- A `keep-trimmed` test would become meaningless after trimming.
- A D scenario has no covering application test and cannot be ported by
  copying.

- [ ] Classification table in Comments covers all 39 tests
- [ ] Every D row resolved to a covering test or a port; ports added
- [ ] Deletions and trims applied; per-endpoint R6 and per-problem-code R1 present
- [ ] Both suites pass; counts and duration recorded
- [ ] Types and lint clean

## Comments

### 2026-09-20 — implementation

Problem codes each endpoint can emit (from `wallet.routes.ts` + `request-validation.ts`):

- `GET /v1/wallets`: `unauthenticated`, `bad-request` (query middleware)
- `GET /v1/wallets/{walletId}`: `unauthenticated`, `not-found`
- `POST /v1/wallets`: `unauthenticated`, `idempotency-key-required`, `bad-request` (malformed JSON), `invalid-command` (schema path and application-issue path), `idempotency-conflict`
- `PUT /v1/wallets/{walletId}/opening`: `unauthenticated`, `bad-request`, `invalid-command` (schema path, `invalid-opening` issues path, `movement-before-opening` path), `not-found`
- `PATCH /v1/wallets/{walletId}`: `unauthenticated`, `bad-request`, `invalid-command`, `not-found`
- `DELETE /v1/wallets/{walletId}`: `unauthenticated`, `not-found`, `conflict`

Classification table (application file: `packages/application/src/wallets/wallet.integration.test.ts` unless noted):

| #   | describe                           | test title                                                                            | class       | problem code if R1       | keep / delete / keep-trimmed                                   | covering application test if D (or for trimmed assertion)                                                                                                                                                                                                                                                                                                                |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------- | ----------- | ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | GET /v1/wallets                    | lists the signed-in owner's wallets with exact money in creation order                | R6, R4      |                          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 2   | GET /v1/wallets                    | an owner with no wallets receives an empty collection                                 | D           |                          | delete                                                         | `listWallets` :: "another user's wallets never appear in a listing" (asserts `[]` for an owner with none); the `{ items, page: { nextCursor: null } }` shape stays proven by row 1                                                                                                                                                                                       |
| 3   | GET /v1/wallets                    | never lists another owner's wallets                                                   | R3          |                          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 4   | GET /v1/wallets                    | rejects an anonymous request with the standard problem                                | R1          | unauthenticated          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 5   | GET /v1/wallets                    | an as-of date reports the end-of-day balance on that date                             | D           |                          | delete                                                         | `listWallets` :: "overall balances retain satang beyond JavaScript integer precision and allow negative holdings" (asOf before a wallet opened → `0n`; opening counts from its own date); `transactions/transaction-create.integration.test.ts` :: "one transfer subtracts from its source and adds to its destination on its date" (asOf before / on the transfer date) |
| 6   | GET /v1/wallets                    | a malformed as-of date is a bad request                                               | R1          | bad-request              | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 7   | GET /v1/wallets                    | an unknown query parameter is a bad request                                           | D (by rule) | bad-request (second)     | **unresolved — see question below; left untouched**            | none — HTTP-only (`z.strictObject` query schema), not portable by copying                                                                                                                                                                                                                                                                                                |
| 8   | GET /v1/wallets/{walletId}         | returns the owner's wallet with its archived instant                                  | R6, R4      |                          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 9   | GET /v1/wallets/{walletId}         | another owner's wallet is not found, indistinguishably from a missing or malformed id | R1, R3      | not-found                | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 10  | GET /v1/wallets/{walletId}         | rejects an anonymous request with the standard problem                                | R1          | unauthenticated          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 11  | POST /v1/wallets                   | creates the wallet and answers with its representation and location                   | R6, R4      |                          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 12  | POST /v1/wallets                   | a retry with the same key and payload replays the original creation                   | R5          |                          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 13  | POST /v1/wallets                   | the same key with a different payload conflicts and creates nothing more              | R1, R5      | idempotency-conflict     | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 14  | POST /v1/wallets                   | distinct keys open distinct wallets from the same payload                             | D           |                          | delete                                                         | `createWallet` :: "distinct keys open distinct wallets from the same command"                                                                                                                                                                                                                                                                                            |
| 15  | POST /v1/wallets                   | concurrent retries create one wallet and answer every request alike                   | D           |                          | delete                                                         | `createWallet` :: "concurrent retries open one wallet and replay it to the rest"                                                                                                                                                                                                                                                                                         |
| 16  | POST /v1/wallets                   | a missing, blank, or over-long Idempotency-Key is a bad request that creates nothing  | R1, R5      | idempotency-key-required | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 17  | POST /v1/wallets                   | a malformed body is rejected field by field and does not consume the key              | R2, R1, R5  | invalid-command          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 18  | POST /v1/wallets                   | a well-formed command the application rejects is addressed by field                   | R2          |                          | keep-trimmed: drop `listWalletItems(...).toEqual([])`          | `createWallet` :: "a rejected command consumes nothing, so the corrected retry may reuse its key" (the rejected command opens no wallet). Kept as R2 because it proves the application-issue → `WALLET_ISSUE_POINTERS` mapping, a different route branch from row 17's schema path                                                                                       |
| 19  | POST /v1/wallets                   | malformed JSON is a bad request                                                       | R1          | bad-request              | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 20  | POST /v1/wallets                   | rejects an anonymous request with the standard problem                                | R1          | unauthenticated          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 21  | PUT /v1/wallets/{walletId}/opening | replaces the opening and answers with the updated wallet                              | R6, R4      |                          | keep-trimmed: drop the `listWalletChangeActions` assertion     | `replaceWalletOpening` :: "replaces amount and date together, records the change, and keeps recording times" (asserts the `opening` change row)                                                                                                                                                                                                                          |
| 22  | PUT /v1/wallets/{walletId}/opening | repeating the same replacement answers alike and records nothing more                 | D           |                          | delete                                                         | `replaceWalletOpening` :: "replacing with the current opening changes nothing and records no history"                                                                                                                                                                                                                                                                    |
| 23  | PUT /v1/wallets/{walletId}/opening | a malformed body is rejected field by field                                           | R2, R1      | invalid-command          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 24  | PUT /v1/wallets/{walletId}/opening | an opening the application rejects is addressed by field                              | R2          |                          | keep-trimmed: drop `readWallet(...).toEqual(created)`          | `replaceWalletOpening` :: "an invalid opening is rejected before the wallet is touched". Kept as R2: proves the `invalid-opening` issues → `OPENING_ISSUE_POINTERS` branch of `toOpeningFieldErrors`                                                                                                                                                                     |
| 25  | PUT /v1/wallets/{walletId}/opening | a movement before the proposed opening, even a deleted one, is addressed to the date  | R2          |                          | keep-trimmed: drop the trailing `accepted` request + assertion | `replaceWalletOpening` :: "a movement before the proposed opening on either transfer side is rejected, even once deleted" (asserts the on-date replacement is `ok`). Kept as R2: proves the `movement-before-opening` → `#/date` branch of `toOpeningFieldErrors`                                                                                                        |
| 26  | PUT /v1/wallets/{walletId}/opening | another owner's wallet is not found, indistinguishably from a missing or malformed id | R1, R3      | not-found                | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 27  | PUT /v1/wallets/{walletId}/opening | malformed JSON is a bad request                                                       | R1          | bad-request              | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 28  | PUT /v1/wallets/{walletId}/opening | rejects an anonymous request with the standard problem                                | R1          | unauthenticated          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 29  | PATCH /v1/wallets/{walletId}       | archives and answers with the updated wallet                                          | R6, R4      |                          | keep-trimmed: drop the `listWalletChangeActions` assertion     | `setWalletArchived` :: "archives, records the change, and returns the updated wallet" (asserts the `archive` change row)                                                                                                                                                                                                                                                 |
| 30  | PATCH /v1/wallets/{walletId}       | restores by clearing the archived instant                                             | D           |                          | delete                                                         | `setWalletArchived` :: "restores by clearing the archived instant and records the change"                                                                                                                                                                                                                                                                                |
| 31  | PATCH /v1/wallets/{walletId}       | repeating the same state answers alike and records nothing more                       | D           |                          | delete                                                         | `setWalletArchived` :: "repeating the same state changes nothing and records no history"                                                                                                                                                                                                                                                                                 |
| 32  | PATCH /v1/wallets/{walletId}       | a malformed or unrelated body is rejected field by field                              | R2, R1      | invalid-command          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 33  | PATCH /v1/wallets/{walletId}       | another owner's wallet is not found, indistinguishably from a missing or malformed id | R1, R3      | not-found                | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 34  | PATCH /v1/wallets/{walletId}       | malformed JSON is a bad request                                                       | R1          | bad-request              | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 35  | PATCH /v1/wallets/{walletId}       | rejects an anonymous request with the standard problem                                | R1          | unauthenticated          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 36  | DELETE /v1/wallets/{walletId}      | deletes an eligible wallet with no response body and makes a repeat not found         | R6, R4, R1  | not-found                | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 37  | DELETE /v1/wallets/{walletId}      | returns one stable conflict problem for every retained-history blocker                | R1          | conflict                 | keep                                                           | (see note below)                                                                                                                                                                                                                                                                                                                                                         |
| 38  | DELETE /v1/wallets/{walletId}      | does not disclose missing or another owner's wallets                                  | R3          |                          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |
| 39  | DELETE /v1/wallets/{walletId}      | rejects an anonymous request with the standard problem                                | R1          | unauthenticated          | keep                                                           |                                                                                                                                                                                                                                                                                                                                                                          |

Judgment calls worth a reviewer's eye:

- Rows 18, 24, 25 each carry `invalid-command` after row 17 / row 23 already
  hold the R1 slot. I classified them R2 rather than D because each proves a
  different route-owned mapping branch (`toWalletFieldError`,
  `toOpeningFieldErrors` issues path, `toOpeningFieldErrors`
  `movement-before-opening` path); deleting them would leave a wrong field
  pointer in those branches undetected by any test. Only their side-effect
  assertions (domain-owned) were trimmed.
- Rows 9, 26, 33, 38: the "still intact afterwards" checks in the ownership
  tests were kept as part of R3 (spec story 11), not trimmed.
- Row 37 asserts only status/code, so nothing was trimmed, but its fixture
  enumerates all three blockers (six wallets, a PATCH, a snapshot) to reach
  one `conflict`. The application suite proves each blocker separately.
  Shrinking the fixture would be a rewrite, which this ticket forbids; noted
  as a follow-up candidate.
- Rows 5 and 30 delete the only route tests that send `?asOf=` /
  `{ archived: false }` on a success path. Row 6 / row 32 still prove those
  inputs are parsed, and rows 1 / 29 prove the forwarding wiring for the
  endpoint, so I followed the rule; flagging in case the reviewer wants a
  route-level "query parameter reaches the application" check kept.
- No PORT rows: every D scenario had an assertion-level match.

**Stop and ask (row 7).** "an unknown query parameter is a bad request" is
the second `bad-request` test in `GET /v1/wallets`, so the first-test rule
makes it D. But it proves no domain rule (it exercises the `z.strictObject`
query schema through `createQueryMiddleware`), there is no application test
to name, and it cannot be ported by copying — `request-validation.unit.test.ts`
only covers `createInvalidCommandProblem`. That is trigger 3. Options I see:
(a) delete it, accepting that strict-query rejection is proven nowhere;
(b) keep it as a second R1 representative on the grounds that it is a
distinct route-owned validation path (like rows 18/24/25); (c) add a unit
test for `createQueryMiddleware` and then delete it (out of this ticket's
scope). I left the test untouched pending the answer and completed every
other row.

**Applied.** Deleted rows 2, 5, 14, 15, 22, 30, 31 (7 tests). Trimmed rows
18, 21, 24, 25, 29 (assertions removed only; titles and requests unchanged).
Removed the then-unused `listWalletChangeActions` helper, the
`walletChanges` and `insertTransaction` imports, and the `committed`
destructure (its only user was row 15). No production code and no
application test changed.

Per-endpoint coverage after the trim (R6 = happy path; R1 = one test per
emittable problem code):

- `GET /v1/wallets`: R6 row 1; R1 `unauthenticated` row 4, `bad-request` row 6 (row 7 also still present, see question above).
- `GET /v1/wallets/{walletId}`: R6 row 8; R1 `unauthenticated` row 10, `not-found` row 9.
- `POST /v1/wallets`: R6 row 11; R1 `unauthenticated` row 20, `idempotency-key-required` row 16, `bad-request` row 19, `invalid-command` row 17, `idempotency-conflict` row 13.
- `PUT /v1/wallets/{walletId}/opening`: R6 row 21; R1 `unauthenticated` row 28, `bad-request` row 27, `invalid-command` row 23, `not-found` row 26.
- `PATCH /v1/wallets/{walletId}`: R6 row 29; R1 `unauthenticated` row 35, `bad-request` row 34, `invalid-command` row 32, `not-found` row 33.
- `DELETE /v1/wallets/{walletId}`: R6 row 36; R1 `unauthenticated` row 39, `not-found` row 36, `conflict` row 37.

Ran (one package at a time):

- `pnpm --filter @bookkeeping/application exec vitest run` — 172 passed (unchanged; no ports needed)
- `pnpm --filter @bookkeeping/server exec vitest run` — 202 passed (before: 209; −7). JSON reporter, `wallet.routes.integration.test.ts`: 39 tests / 377 ms before → 32 tests / 268 ms after (file `endTime − startTime`; run-to-run noise is a few tens of ms)
- `pnpm --filter @bookkeeping/server types:check`, `pnpm --filter @bookkeeping/application types:check`, `pnpm lint` — clean

**2026-09-20 — closed.** Resolved in `d2cf71a` (test: trim the wallet route suite to http scope). Status line was stale after the commit landed.
