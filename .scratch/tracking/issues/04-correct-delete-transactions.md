# 04: Correct and delete transactions

**What to build:** Open income/expense records from detail, correct their fields, or delete mistakes, while balances update and internal change history remains honest.

**Blocked by:** 02: Record income and expenses reliably.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Provide a full-screen edit experience with fixed type and an explanation that changing type requires delete/recreate. Existing wallet/amount/category/date/note values are loaded accurately.
- [ ] Permit valid field edits subject to ownership, exact amount/note limits, correct category tree, Bangkok future-date rules, and affected wallet opening dates.
- [ ] Editing replaces financial effects; deletion removes the transaction from normal list/detail, current balances, and applicable historical calculations. Neither action adds a separate visible reversal entry.
- [ ] Preserve original recording time and retain internal change history for successful edits/deletes atomically with the financial change. Failed operations leave no partial effect or successful-change history.
- [ ] Retain enough durable submission receipt information that a late create retry never restores old values or recreates a deleted transaction.
- [ ] Delete is available from edit's destructive action with clear feedback. Keep values on errors and announce field validation; successful edits return to the list with the row highlighted, and deleted records no longer appear normally.
- [ ] Reuse the category interaction established by 02; when 03's custom category flow is available it works on edit too, without making 03 a prerequisite.
- [ ] Keep extension points for later transfer/refund-specific corrections without prebuilding their feature layers. Apply impeccable to the confirmed edit brief, including fixed-type labeling, Bangkok recording footer, keyboard completeness, and phone/desktop verification.
- [ ] Use PostgreSQL operation tests for owner isolation, changed wallets/dates/amounts, exact balance effects, rollback/history atomicity, and late retries after edit/deletion. Add focused browser edit/delete coverage.
- [ ] Run relevant tests and existing repository checks.

## Scope and handoff

Transfer corrections are delivered in 05; linked-refund and refunded-expense guards in 07. Opening balance corrections belong to 06. Covers spec criteria 1–3, 9–11, 14, 23–25 for income/expenses.
