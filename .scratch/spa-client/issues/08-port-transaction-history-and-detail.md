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

**Status:** ready-for-agent

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

- [ ] History lists saved transactions newest first with type word, sign, amount, wallet, category, and dates as `DESIGN.md` describes; long amounts wrap beneath the description.
- [ ] Filters apply and clear through the URL, survive reload, and the disclosure is open when filters are active.
- [ ] Paging follows the API cursor; the last page shows no further control.
- [ ] Detail shows every field the legacy page shows, including Archived wallet labels.
- [ ] Loading shows neutral skeletons with no sample money; an API error shows the legacy error component.
- [ ] Browser spec `history.spec.ts` is ported one for one and passes on `phone-chromium`; the legacy copy is deleted.
- [ ] `pnpm run ci` is green.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium history`.
