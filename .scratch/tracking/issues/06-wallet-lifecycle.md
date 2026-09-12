# 06: Manage wallet lifecycle and opening corrections

**What to build:** Correct a wallet's opening amount/date, archive or restore it, and delete unused wallets without losing financial history or making archived money disappear.

**Blocked by:** 04: Correct and delete transactions.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Provide wallet management controls for opening amount/date corrections, archive, unarchive, and guarded permanent deletion.
- [ ] Correct opening amounts exactly, recompute affected balances, and retain changes atomically in internal history. An opening-date change cannot exclude an existing movement, including either side of a transfer when transfers are available.
- [ ] Allow archiving at any balance; show remaining balance in management and retain archived wallets in overall current/historical totals.
- [ ] Exclude archived wallets from new-entry defaults/pickers and prohibit new movements involving them on the server. Enforce this atomically against a concurrent archive/create race.
- [ ] Keep existing archived-wallet entries editable/deletable with an Archived label. An edit may retain its original archived wallet but cannot select a different archived wallet.
- [ ] Without active wallets, entry shows a create/unarchive action. Unarchiving restores normal eligibility without changing historical financial effects.
- [ ] Permanent deletion requires no transactions; zero balance is insufficient. Retained deleted-transaction/change history cannot be erased by a wallet cascade; fail with useful feedback when references remain.
- [ ] Own-data isolation covers every management operation and balance view. Preserve original transaction recording times during wallet changes.
- [ ] Apply impeccable to phone/desktop management and relevant entry states; use clear destructive/archive feedback, labeled controls, and accessible errors.
- [ ] PostgreSQL tests cover opening corrections/date guards, ownership, archived totals, create/archive races, retained-entry corrections, and guarded deletion. Verify end-to-end archive/unarchive in the browser.
- [ ] Integrate with 05 when available without adding a dependency: both transfer wallet references obey these rules. The refund ticket extends them to receiving wallets. Run relevant tests and existing repository checks.

## Scope and handoff

Do not add reconciliation or a silent set-current-balance action. Refund-specific archived-wallet defaults belong to 07; user-facing as-of reports belong to 09. Covers spec criteria 1–3, 7, 9, 23–25 and opening-date guards for existing types.
