# 15: Create wallets idempotently over HTTP

**What to build:** Let an authenticated client create a wallet safely across
network retries using server-authoritative money and calendar-date validation.

**Blocked by:** 13: Introduce reusable creation idempotency; 14: Expose wallet list and detail reads

**Status:** done

- [x] Wallet creation moves to the application package and remains the single operation used by Next.js and Hono.
- [x] The HTTP request uses a semantic Money object and never converts through JavaScript `number`.
- [x] A valid creation returns `201`, the direct wallet representation, and its canonical location.
- [x] Missing or malformed idempotency keys, invalid inputs, replay, changed-payload conflict, and concurrency have stable contracts.
- [x] Validation, application, HTTP, runtime-schema, and OpenAPI tests cover the complete behavior.

## Comments

- Wallet creation now lives in `@bookkeeping/application/wallets` as
  `createWallet`, which validates the command (`validateWalletCreation`:
  visible name, opening within the domain's fifteen whole digits, real
  calendar date no later than today in Bangkok, every issue reported) before
  `executeIdempotentCreation` under the `wallets.create` operation, so a
  rejected command never consumes its key. The receipt stores the created
  wallet with satang as decimal strings; a created wallet is never archived,
  so the snapshot holds `archivedAt: null` only. The web Server Action and
  the Hono route are its two callers; the web-owned `server/wallet.ts` is
  gone and web tests open wallets through `src/testing/wallet-fixture.ts`.
- `core/http/money.ts` gained `moneyInputSchema` (`MoneyInput`): the
  value grammar derives from the domain's exported `MAX_WHOLE_DIGITS` and
  the transform parses through `parseMoneyInput`, never `number`.
  `core/http/idempotency.ts` owns the lower-cased header schema, the ready
  `idempotencyKeyMiddleware`, and the `idempotency-key-required` (400) and
  `idempotency-conflict` (409) problems, both added to `problemCodes`.
  `core/http/request-validation.ts` turns validator issues into 422
  `invalid-command` field errors addressed by RFC 6901 JSON Pointer with
  kebab-case codes (a custom issue's `params.code` wins).
- `POST /v1/wallets` answers 201 with the wallet and a
  `Location: /v1/wallets/{id}` built from the served path; a same-key
  same-payload retry replays that 201 (`"12000.5"` and `"12000.50"` are
  the same validated payload). Application rejections map to 422 with
  `#/name`, `#/openingAmount/value`, `#/openingDate` pointers; malformed
  JSON is the standard 400. `z.iso.date()` already rejects impossible dates,
  so the application's `invalid` date issue is unreachable over HTTP and is
  covered only by its unit test.
- The Next.js form mints a fresh `submissionKey` per submit; a replay
  state like the transaction form's was tried and dropped in review because
  the wallet form does not lock its fields while a retry is pending.
- Tests: application unit (validation), application PostgreSQL (create,
  replay, replay after archive/removal, conflict, distinct keys, rejection
  not consuming the key, concurrency), server unit (money input, issue
  mapping, OpenAPI operation/header/request body/`Location`/problems), and
  in-process HTTP (201 + Location round trip, replay, conflict, distinct
  keys, concurrency, missing/blank/over-long key, schema and application
  422s, malformed JSON, 401). The focused `wallets.spec.ts` E2E passed on
  the desktop project. The routine gate passed with Biome scoped to
  `apps packages` because the stray `.kilo/worktrees/` checkout still
  makes root `biome ci .` reject a nested configuration.
- Two-axis review: standards findings fixed (validation folded into
  `wallet.ts` instead of forwarding exports, Zod-parsed issue details, a
  literal field union, one problem-description helper, the digit limit owned
  by the domain); the typed `describeResponse` still needs the 409/422
  bodies built with `createProblemDetails` rather than
  `createProblemResponse`. Spec findings fixed (over-long key contract and
  test, replay-after-change test, hook replay state removed).
