# 08: Port transaction history and detail

Read `../worker-brief.md` first.

**What to build:** `/transactions` with the divided rows, the disclosure of
From/To, wallet, category, and type filters carried in the URL, cursor
paging, loading and error states; and `/transactions/$transactionId` detail
with financial date and recording time on separate lines, the wallet
labels (including Archived), and links to edit, refund, and the original
expense where they apply (the targets land in later tickets and may 404
until then).

**Blocked by:** 07: Port transaction entry

**Status:** done

**Pattern to copy:**

- Legacy `features/transactions`: history, list, filters, filter select,
  history schema (with unit test), loading and error components,
  transaction detail, linked-expense helper.
- URL state: validate search params with the history schema in the route's
  `validateSearch`; the loader reads the list with the cursor from the URL.
- Legacy `loading.tsx` and `error.tsx` become the route's
  `pendingComponent` and `errorComponent`.

**Out of scope:** refund panel data (09); delete button behaviour (10);
infinite scroll or any paging model other than the cursor the API offers;
new filters.

- [x] History lists saved transactions newest first with type word, sign, amount, wallet, category, and dates as `DESIGN.md` describes; long amounts wrap beneath the description.
- [x] Filters apply and clear through the URL, survive reload, and the disclosure is open when filters are active.
- [x] Paging follows the API cursor; the last page shows no further control.
- [x] Detail shows every field the legacy page shows, including Archived wallet labels.
- [x] Loading shows neutral skeletons with no sample money; an API error shows the legacy error component.
- [x] Browser spec `history.spec.ts` is ported one for one and passes on `phone-chromium`; the legacy copy is deleted.
- [x] `pnpm run ci` is green.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium history`.

## Comments

Ported `/transactions` and `/transactions/$transactionId` to the SPA. The
history schema now carries two shapes: `historySearchSchema` (the route's
`validateSearch`; raw control text so invalid filters keep editable values)
and `transactionFiltersSchema` (the legacy validation, applied by the loader
and page). The loader ensures the list, wallet, and category reads; the
filter form swaps `next/form` for an `onSubmit` that navigates with the
controls' values; `loading.tsx` and `error.tsx` became `pendingComponent`
and `errorComponent` (retry resets the boundary and invalidates the router).
Paging follows `page.nextCursor` through an "Older transactions" link that
carries the active filters; it is absent on the last page. A 404 from the
detail read throws the router's `notFound`, as the legacy page did.

Deviations:

- The saved-row highlight reads `?created=<id>` (ticket 07's choice), not
  the legacy `?saved=`; the row still carries `data-saved`.
- The Edit link is a plain anchor to `/transactions/<id>/edit` until ticket
  10 adds the route, and "Monthly summary & balances" is a plain anchor to
  `/dashboard` until ticket 11 (as the wallets page already does); the "Record refund" link lives in the refund panel,
  which is ticket 09 with the refunds read.
- The filter form is keyed on the search values so its uncontrolled
  controls remount after a client-side navigation; `next/form` reloaded the
  segment for free. The `?deleted=1` banner is ported now; ticket 10 sets it.
- `linked-expense.ts` was not copied: nothing in history or detail consumes
  it; the refund (09) and edit (10) forms will.
- The legacy `history.spec.ts` also exercised `/dashboard`; those steps
  cannot run until ticket 11 ports it and were not carried over. The SPA
  spec adds a reload assertion (filters survive the address) and detail
  field assertions. `reportSchema` stays for ticket 11.

Verification: `pnpm run ci` green; `history.spec.ts` passed 3 tests on
`phone-chromium`.
