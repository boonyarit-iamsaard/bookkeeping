# 02: Record income and expenses reliably

**What to build:** Record income or an expense from a full-screen form, see the saved transaction in a basic list/detail view, and see its effect on wallet balances. Quick expense entry is amount followed by Save, with reliable handling of duplicate taps and lost responses.

**Blocked by:** 01: Create wallets with dated opening balances.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Support income and expense creation with wallet, amount, date, matching-tree category, and optional note. Creation can switch these two types; saved records retain their type.
- [ ] Initialize each user's editable copies of default income/expense category trees, including exactly one protected Uncategorized parent per tree. Repeat initialization without duplicates or overwriting customization; confirm exact default contents during this ticket.
- [ ] Both parent and child defaults are selectable. Categories belong to the owner and correct income/expense tree; the generic icon is valid without a recommendation dependency.
- [ ] Default to Expense, today in Asia/Bangkok, last-used active wallet, and matching Uncategorized. Without a last-used active wallet use deterministic active-wallet ordering; without an available wallet show a creation action rather than a disabled form.
- [ ] Accept ฿0.01–฿99,999,999.99 exactly as integer satang. Reject empty, invalid, zero, negative, over-limit, and extra-decimal input without rounding. Notes allow at most 200 characters.
- [ ] Date-only entry permits backdating and the wallet's opening day, rejects future/pre-opening dates, and offers Today/Yesterday shortcuts subject to the same rules. Bangkok midnight determines today independently of browser/server locale.
- [ ] Income adds and expenses subtract from derived balances; allow negative results. Backdated entries affect the correct dates. Openings do not become income.
- [ ] Persist an original server recording timestamp, display it separately with Bangkok hours/minutes, and exclude recording order from financial calculations.
- [ ] Bind each logical create key to owner, operation, and canonical validated payload; commit the receipt and transaction together. Same key/payload, including simultaneous requests, saves once; changed payload conflicts; distinct keys permit intentional identical records.
- [ ] Disable Save in flight. On uncertain outcome retain the original snapshot/key, explain the check, and replay it before allowing changed submissions. Confirmed success opens the saved result; definitive no-commit rejection permits correction with a new key. A network error is not definitive rejection.
- [ ] Save reads back amount/wallet, success returns to the basic list with the saved row highlighted, and detail exposes the fields and recording time. Do not rely on a future filtered-list ticket for a usable success destination.
- [ ] Match the confirmed transaction-form brief: amount leads with native decimal keyboard and requested focus, wallet/category/date/note rows, 360px phone support, safe-area-aware reachable Save, desktop Enter/Esc, and no custom keypad.
- [ ] Use stable loading states, values retained on validation/server error, field-associated announced errors, labeled controls, reduced-motion support, minimum 44px touch targets, and minimum 48px phone Save. Apply impeccable and verify phone/desktop behavior.
- [ ] Prove ownership, exact amounts, Bangkok dates, derived balances, receipt atomicity, concurrent duplicates, and changed-payload conflicts through real PostgreSQL operation tests. Browser coverage includes quick entry and a committed transaction with a lost response resolved without duplication.
- [ ] Run relevant tests and existing repository checks. Financial validation occurs on the server, not only in the form.

## Scope and handoff

Custom in-screen categories follow in 03, corrections in 04, transfers in 05, and refunds in 07. Do not expose nonworking Transfer/Refund controls as if supported. Covers spec criteria 1–3, 9–13, 15–16, 24–25 for this ticket's types.
