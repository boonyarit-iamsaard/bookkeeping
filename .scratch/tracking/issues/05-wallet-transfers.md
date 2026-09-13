# 05: Transfer between wallets

**What to build:** Move money between two owned wallets as one transfer, then edit or delete that movement with both wallet balances always changing together.

**Blocked by:** 04: Correct and delete transactions.

**Status:** done

## Acceptance criteria

- [x] Enable Transfer in creation and provide From → To wallet selection with a swap action; hide category. Read back the amount and both wallets before Save.
- [x] Require distinct owned active wallets, explicit THB, positive exact amounts within transaction limits, and a date valid for both opening dates and Bangkok today.
- [x] Prohibit same-wallet transfers on the server as well as the form. When fewer than two active wallets exist, explain what is required rather than permitting an invalid submission.
- [x] Create a single logical transfer and atomically apply its source subtraction/destination addition. Editing wallets/date/amount replaces both effects; deletion removes both. Failed operations leave neither side changed.
- [x] Reuse logical-submission idempotency and uncertain-response replay for creation; duplicate transfers do not duplicate either financial effect.
- [x] Show transfers in basic list/detail with both wallet references and fixed type on edit. Do not count transfers as income or expense; fees are separate normal expenses, not hidden adjustments.
- [x] Preserve original recording time and atomic internal edit/delete history, with exact balances and negative results allowed.
- [x] Respect archive rules whenever wallet lifecycle controls become available; reject new transfers involving archived wallets and allow existing edits to retain their own archived wallet references.
- [x] Match the confirmed form transition without disruptive jumps; maintain labels, focus, safe-area Save, keyboard behavior, and reduced motion. Apply impeccable and verify phone/desktop create/edit.
- [x] PostgreSQL tests prove both sides after create/edit/delete, rollback under failure, opening-date checks, ownership, and simultaneous duplicate submission. Browser coverage verifies the form's From → To and swap behavior.
- [x] Run relevant tests and existing repository checks.

## Scope and handoff

Filtered transfer history and monthly transfer exclusion are verified in 09; do not require 06 to begin this ticket. Covers spec criteria 1–4, 10–14, 23–25 for transfers.
