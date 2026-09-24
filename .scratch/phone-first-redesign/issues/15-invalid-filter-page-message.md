# 15: The page-level invalid-filter message names the wrong problem

Read `../spec.md` first.

**What to build:** When the address carries invalid filters, the message above the history names the fields that are actually invalid.

**Blocked by:** None (can start immediately)

**Status:** needs-triage

**Out of scope:** the sheet's per-field messages, which are already right.

- [ ] `/transactions?from=bogus` says the From date is not valid, not "From date must be on or before To date"; a real From-after-To range still says that.
- [ ] The history spec's invalid-value test asserts the page message for a malformed date and for a reversed range.

## Comments

From 07's milestone critique (2026-09-24): P2, material (WCAG 3.3.1). `apps/web/src/features/transactions/components/transaction-history.tsx:22` hard-codes "Choose valid filters. From date must be on or before To date." for every invalid address. The filter sheet already derives per-field messages (`filterErrors` in `history-filters.tsx`); the page line should share that source.
