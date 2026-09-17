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

## Comments

- From ticket 17's review: the archived-wallet restriction tests currently
  live in the web transaction module (see tickets 17 and 25); when this
  ticket moves refund creation into the application package, its
  archived-wallet cases move into application and HTTP tests with it.
