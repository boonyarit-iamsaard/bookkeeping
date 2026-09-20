# 25: Create income and expenses idempotently

**What to build:** Let an authenticated client create income and expense
transactions with the same exact financial behavior as the current UI.

**Blocked by:** 13: Introduce reusable creation idempotency; 23: Expose transaction detail and supporting reads

**Status:** resolved

- [ ] Transaction creation and its core validation move to the application package without changing Next.js behavior.
- [ ] Income and expense requests use semantic Money, owned active wallets, the correct category tree, valid calendar dates, and bounded notes.
- [ ] Creation uses the reusable idempotency seam and preserves late replay behavior after later edits or deletion.
- [ ] Success returns `201`, the direct transaction detail, and its location.
- [ ] Existing concurrency/idempotency tests and new runtime-schema, OpenAPI, and HTTP tests cover both types and all expected failures.

## Comments

- From ticket 17's review: ticket 17 moved archive behavior to
  `@bookkeeping/application/wallets` and left the archived-entry
  restrictions enforced by the web transaction module
  (`apps/web/src/features/transactions/server/transaction.ts`), covered by
  the web wallet-lifecycle and transaction tests (`wallet-archived`
  rejection, retained edits allowed, restore re-eligible, and the
  lock-recheck test). When this ticket moves transaction creation into the
  application package, the restriction and those cases must move with it
  into application and HTTP tests.

**2026-09-20 — closed.** Resolved in `82f5258` (feat: create income and expenses over http). Status line was stale after the commit landed.
