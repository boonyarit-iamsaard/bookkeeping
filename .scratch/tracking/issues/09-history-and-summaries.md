# 09: Filter history and review financial summaries

**What to build:** Investigate transactions with date/wallet/category/type filters, inspect wallet balances as of a date, and review monthly income, expenses, refunds, and net totals that stay correct after transfers, corrections, archiving, and category removal.

**Blocked by:** 05: Transfer between wallets; 08: Manage categories and removal fallbacks.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Extend the working transaction list with date, wallet, category, and type filters, usable together; show income/expense/transfer/refund distinctly. Refunds link to their expense; transfers identify both wallets.
- [ ] A wallet filter matches either side of a transfer; parent category filtering includes children and direct-parent entries; child filtering matches that child. Refunds use the expense's current category.
- [ ] Normal views exclude deleted records and internal change history. Display financial dates separately from Bangkok original recording time, without treating recording order as financial order.
- [ ] Show current and selected-date end-of-day wallet/overall balances derived from openings and current movements. Include archived holdings; before opening, a wallet contributes nothing. Allow negative balances and exact large aggregated totals.
- [ ] Show monthly income, gross expenses, refunds, net expenses, and net. Net expenses equal gross minus refunds; net equals income minus net expenses. Exclude openings/transfers from income/expense totals.
- [ ] Recognize refunds in their own transaction month, including refunds for prior-month expenses. Bangkok calendar boundaries govern reporting independently of browser/server locale.
- [ ] Income ฿1,000, gross expenses ฿500, and refunds ฿100 yield net expenses ฿400 and net ฿600 regardless of transfers. Later-month refunds count in that later month.
- [ ] Opening corrections, transaction edit/delete, wallet archive, category rename/removal, and refund inheritance appear consistently in lists/filters/as-of balances/summaries without superseded effects.
- [ ] All queries authenticate and scope to the owner, including resource-based filters and linked expense navigation; foreign identifiers never expose another user's records or totals.
- [ ] Apply impeccable to responsive lists, filters, totals, clear empty/loading/error states, accessible labeling/keyboard access, tabular THB figures, and non-color-only type meaning. A list quick-add button is not required.
- [ ] PostgreSQL tests cover combined filters, category descendants/fallbacks, both transfer wallets, current/as-of calculations, exact aggregates, own-date refunds, Bangkok month boundaries, and owner isolation.
- [ ] Browser checks verify filter/report workflows on representative phone/desktop layouts. Complete integrated milestone acceptance verification for the approved spec, including entry/category/refund flows, and resolve regressions rather than leaving a separate QA-only ticket.
- [ ] Run relevant behavior tests and all required existing formatting, lint, type, and build checks; apply appropriate impeccable audit/polish before completing the milestone.

## Scope and handoff

The approved tracking specification's 25 acceptance criteria define milestone completion. This ticket completes criteria 20–22 and integrated verification of the others. Do not add forecasting, budgeting, future entries, reconciliation, export/import, or deployment.
