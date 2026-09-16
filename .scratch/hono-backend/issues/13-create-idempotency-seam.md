# 13: Introduce reusable creation idempotency

**What to build:** Provide one application/database mechanism that resource
creation operations can use to turn uncertain retries into a single committed
result.

**Blocked by:** 08: Extract the PostgreSQL database boundary

**Status:** done

- [x] Idempotency keys are scoped to authenticated owner and operation and bind to a canonical validated payload fingerprint.
- [x] The receipt and created result commit atomically, including under concurrent requests.
- [x] Same-key same-payload retries return the original result; changed payloads return an explicit conflict.
- [x] Validation or application rejection before commit does not consume the key.
- [x] The mechanism can support wallet, category, and transaction resources without storing presentation DTOs.
- [x] PostgreSQL integration tests exercise sequential, concurrent, conflict, rollback, and replay cases.

## Comments

- Added `@bookkeeping/application/idempotency` with
  `executeIdempotentCreation`, deterministic SHA-256 fingerprinting for typed
  validated payloads (including `bigint`), a stable `idempotency-conflict`
  result, and caller-owned codecs for transport-independent application result
  snapshots.
- Added the generic `creation_receipts` PostgreSQL table under
  `@bookkeeping/database/idempotency`. Its owner/operation/key unique scope and
  stored payload fingerprint/result have no resource foreign key, so the
  original result remains replayable after a resource changes or is removed.
- Identical scopes serialize with a transaction advisory lock. Creation runs
  behind a savepoint, so an expected application rejection rolls back any
  partial writes without consuming the key; receipt failures roll back the
  resource and receipt together. No migration was generated or applied.
- Kept the existing transaction-specific receipt path in place for the
  temporary Next.js operation; ticket 25 moves transaction creation onto this
  reusable seam when that operation moves to the application package.
- Added pure fingerprint unit tests and PostgreSQL integration coverage for
  sequential replay, replay after update/deletion, changed-payload conflict,
  owner/operation scoping, concurrency, application rejection, and receipt
  failure rollback. `pnpm run ci` passes all formatting, lint, typecheck, unit,
  and integration gates.
- The required two-axis review found no spec gaps. Its two standards findings
  were fixed by replacing exception-based rejection control flow with a
  savepoint rollback and parsing stored test data through Zod; re-review found
  no remaining standards violations.
