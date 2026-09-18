# 09: Filter history and review financial summaries

**What to build:** Investigate transactions with date/wallet/category/type filters, inspect wallet balances as of a date, and review monthly income, expenses, refunds, and net totals that stay correct after transfers, corrections, archiving, and category removal.

**Blocked by:** 05: Transfer between wallets; 08: Manage categories and removal fallbacks.

**Status:** done

## Acceptance criteria

- [x] Extend the working transaction list with date, wallet, category, and type filters, usable together; show income/expense/transfer/refund distinctly. Refunds link to their expense; transfers identify both wallets.
- [x] A wallet filter matches either side of a transfer; parent category filtering includes children and direct-parent entries; child filtering matches that child. Refunds use the expense's current category.
- [x] Normal views exclude deleted records and internal change history. Display financial dates separately from Bangkok original recording time, without treating recording order as financial order.
- [x] Show current and selected-date end-of-day wallet/overall balances derived from openings and current movements. Include archived holdings; before opening, a wallet contributes nothing. Allow negative balances and exact large aggregated totals.
- [x] Show monthly income, gross expenses, refunds, net expenses, and net. Net expenses equal gross minus refunds; net equals income minus net expenses. Exclude openings/transfers from income/expense totals.
- [x] Recognize refunds in their own transaction month, including refunds for prior-month expenses. Bangkok calendar boundaries govern reporting independently of browser/server locale.
- [x] Income ฿1,000, gross expenses ฿500, and refunds ฿100 yield net expenses ฿400 and net ฿600 regardless of transfers. Later-month refunds count in that later month.
- [x] Opening corrections, transaction edit/delete, wallet archive, category rename/removal, and refund inheritance appear consistently in lists/filters/as-of balances/summaries without superseded effects.
- [x] All queries authenticate and scope to the owner, including resource-based filters and linked expense navigation; foreign identifiers never expose another user's records or totals.
- [x] Apply impeccable to responsive lists, filters, totals, clear empty/loading/error states, accessible labeling/keyboard access, tabular THB figures, and non-color-only type meaning. A list quick-add button is not required.
- [x] PostgreSQL tests cover combined filters, category descendants/fallbacks, both transfer wallets, current/as-of calculations, exact aggregates, own-date refunds, Bangkok month boundaries, and owner isolation.
- [x] Browser checks verify filter/report workflows on representative phone/desktop layouts. Complete integrated milestone acceptance verification for the approved spec, including entry/category/refund flows, and resolve regressions rather than leaving a separate QA-only ticket.
- [x] Run relevant behavior tests and all required existing formatting, lint, type, and build checks; apply appropriate impeccable audit/polish before completing the milestone.

## Scope and handoff

The approved tracking specification's 25 acceptance criteria define milestone completion. This ticket completes criteria 20–22 and integrated verification of the others. Do not add forecasting, budgeting, future entries, reconciliation, export/import, or deployment.

## Comments

2026-09-14 — Implemented history filters and financial reports on the current branch.

- Combined inclusive date, wallet, category and type filters use current,
  owner-scoped transactions. Transfers match both wallets, parents include
  direct entries/children, and refunds follow their expense's current category
  and link to its detail. Financial dates and original Bangkok recording times
  are shown separately; deleted rows and internal change history stay out.
- `/dashboard` now shows exact monthly income, gross expenses, refunds,
  net expenses and net, plus current and selected-date wallet/overall balances.
  Openings/transfers are excluded from monthly activity; refunds count in their
  own month. Existing balance derivation retains archived and negative holdings
  and excludes unopened wallets. Transaction changes revalidate reports.
- PostgreSQL behavior checks cover combined filters, both transfer wallets,
  category/refund fallbacks, correction/deletion, own-month refunds, Bangkok
  boundaries, isolation and exact large totals. Year zero is rejected before
  PostgreSQL; invalid inputs retain editable filters.
- Impeccable audit/polish preserves the existing visual system with responsive
  labeled controls, divided totals, tabular THB, empty/loading/error states,
  explicit type meaning and a keyboard-accessible filter disclosure. Phone and
  desktop screenshot review confirmed saved rows remain visible, active filters
  open, and report layouts fit without page overflow.
- Verification: full unit/PostgreSQL suite **129 passed**; affected server suite
  after review fixes **52 passed**; full production browser suite **42 passed**;
  final history/report keyboard, disclosure, validation and timezone confirmation
  **6 passed**, including a Los Angeles browser timezone. Lint, formatting,
  Markdown lint, typecheck and production build passed. Production builds used
  `pnpm build --webpack`: Turbopack's CSS helper could not bind a port in this
  environment. Generated Next.js validators were regenerated after overlapping
  dev/build/type-generation exposed a write race; final checks ran sequentially.
- Standards and spec reviews are clear after the minor API/name and year-zero
  fixes. No schema changes or migrations. Integrated milestone acceptance is
  recorded in [milestone verification](../milestone-verification.md).
