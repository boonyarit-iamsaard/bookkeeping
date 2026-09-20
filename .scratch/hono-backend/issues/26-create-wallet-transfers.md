# 26: Create wallet transfers over HTTP

**What to build:** Extend transaction creation so an authenticated client can
move money atomically between two owned active wallets.

**Blocked by:** 25: Create income and expenses idempotently

**Status:** resolved

- [ ] The transaction request contract accepts transfers without category or refund fields.
- [ ] Source and destination are distinct, owned, active, and open by the transaction date.
- [ ] One committed transfer changes both derived balances or neither and remains idempotent under retry and concurrency.
- [ ] Transfer-specific validation and ownership failures use stable Problem Details.
- [ ] Application, HTTP, runtime-schema, and OpenAPI tests cover success, replay, conflict, invalid shape, and cross-owner identifiers.

## Comments

**2026-09-20 — closed.** Resolved in `0674d37` (feat: create wallet transfers over http). Status line was stale after the commit landed.
