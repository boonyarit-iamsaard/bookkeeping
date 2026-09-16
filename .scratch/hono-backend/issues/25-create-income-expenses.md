# 25: Create income and expenses idempotently

**What to build:** Let an authenticated client create income and expense
transactions with the same exact financial behavior as the current UI.

**Blocked by:** 13: Introduce reusable creation idempotency; 23: Expose transaction detail and supporting reads

**Status:** ready-for-agent

- [ ] Transaction creation and its core validation move to the application package without changing Next.js behavior.
- [ ] Income and expense requests use semantic Money, owned active wallets, the correct category tree, valid calendar dates, and bounded notes.
- [ ] Creation uses the reusable idempotency seam and preserves late replay behavior after later edits or deletion.
- [ ] Success returns `201`, the direct transaction detail, and its location.
- [ ] Existing concurrency/idempotency tests and new runtime-schema, OpenAPI, and HTTP tests cover both types and all expected failures.
