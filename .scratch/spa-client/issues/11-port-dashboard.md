# 11: Port the dashboard

Read `../worker-brief.md` first.

**What to build:** `/dashboard` reviewing a chosen month and balance date:
the monthly definition list (income, gross expenses, refunds, net expenses,
net), wallet rows with current and selected-date balances including the
overall row and Archived labels, the month picker, empty, loading, and error
states, with filter values kept in the URL. History and wallets keep their
links to the report.

**Blocked by:** 10: Port transaction corrections

**Status:** done

**Pattern to copy:**

- Legacy `features/transactions` financial report component and the
  dashboard page, loading and error components; the month picker already
  copied in ticket 02.
- Reads: monthly report and wallets-as-of query options; search params
  validated in the route.

**Out of scope:** charts, trends, budgets, comparisons, or any figure the
legacy dashboard does not show; caching reports offline.

- [x] The dashboard shows the five monthly figures and the wallet balances for the selected month and date, with net at stronger weight and archived wallets labelled.
- [x] Changing the month or date updates the URL and the figures; an invalid URL value falls back as the legacy page does, controls still editable.
- [x] Empty, loading (no sample money), and error states match the legacy page.
- [x] Browser spec `dashboard.spec.ts` covers a month with income, expense, refund, and transfer and passes on `phone-chromium`.
- [x] `pnpm run ci` is green.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium dashboard`.

## Comments

Ported the legacy monthly summary and wallet balance report to the SPA with
URL-backed month and balance-date filters, query loading/error handling, and
the existing links from Transactions and Wallets. Added filter-schema unit
coverage and `dashboard.spec.ts`; the focused `phone-chromium` spec passes.
There was no legacy dashboard browser spec in `apps/legacy-web/tests/e2e/` to
retire.
