# 15: The page-level invalid-filter message names the wrong problem

Read `../spec.md` first.

**What to build:** When the address carries invalid filters, the message above the history names the fields that are actually invalid.

**Blocked by:** None (can start immediately)

**Status:** done

**Out of scope:** the sheet's per-field messages, which are already right.

- [x] `/transactions?from=bogus` says the From date is not valid, not "From date must be on or before To date"; a real From-after-To range still says that.
- [x] The history spec's invalid-value test asserts the page message for a malformed date and for a reversed range.

## Comments

From 07's milestone critique (2026-09-24): P2, material (WCAG 3.3.1). `apps/web/src/features/transactions/components/transaction-history.tsx:22` hard-codes "Choose valid filters. From date must be on or before To date." for every invalid address. The filter sheet already derives per-field messages (`filterErrors` in `history-filters.tsx`); the page line should share that source.

Triaged (2026-09-24): in scope with the rest of 12–18, after 13.

Closed (2026-09-24):

- Built in 1a3bc8e and 270edee. `parseHistoryFilters` in `history-schema.ts`
  returns the parsed filters or one message per invalid field. The route reads
  it once for both the list query and the page's alert, and the filter sheet
  reads the same messages, so the page and the sheet can't disagree. A
  malformed date names its field; only a real From-after-To range names the
  date order.
- `pnpm run ci` passes, and so does `history.spec.ts` on `phone-chromium`. The
  invalid-value test asserts the page message for a reversed range, for
  `from=0000-01-01`, and for `from=bogus` (which must not mention the date
  order).
