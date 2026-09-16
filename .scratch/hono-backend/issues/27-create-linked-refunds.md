# 27: Create linked refunds over HTTP

**What to build:** Extend transaction creation so an authenticated client can
record a full or partial refund linked to an owned expense.

**Blocked by:** 26: Create wallet transfers over HTTP

**Status:** ready-for-agent

- [ ] The request contract accepts refunds only through an owned expense link and an owned active receiving wallet.
- [ ] The server enforces expense/refund dates, wallet opening, remaining refundable amount, inherited category, and positive exact money.
- [ ] Concurrent refunds cannot exceed the expense, and retry behavior remains idempotent.
- [ ] Success returns complete refund detail including its expense link.
- [ ] Application and HTTP tests cover full, partial, alternate-wallet, archived-wallet, limit, date, concurrent, and cross-owner cases.
