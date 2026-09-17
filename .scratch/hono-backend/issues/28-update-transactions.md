# 28: Update transactions over HTTP

**What to build:** Let an authenticated client correct an existing transaction
without changing its type or violating linked financial history.

**Blocked by:** 27: Create linked refunds over HTTP

**Status:** ready-for-agent

- [ ] Transaction update behavior and internal history ownership move to the application package.
- [ ] Updates preserve type and validate exact money, dates, wallets, categories, transfer shape, refund links, and archived-resource retention rules.
- [ ] Expense and refund changes preserve combined refund amounts and linked date constraints under concurrency.
- [ ] Success returns the updated transaction detail; missing and cross-owner resources remain non-disclosing.
- [ ] PostgreSQL and HTTP tests cover every transaction type, no-op update, rollback, history, conflicts, and invalid input.

## Comments

- From ticket 17's review: the retained-edits-on-archived-wallet cases
  currently live in the web wallet-lifecycle tests (see tickets 17 and
  25); when this ticket moves transaction updates into the application
  package, those cases move into application and HTTP tests with it.
