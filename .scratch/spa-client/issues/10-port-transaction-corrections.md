# 10: Port transaction corrections

Read `../worker-brief.md` first.

**What to build:** Editing a transaction at
`/transactions/$transactionId/edit` and deleting it from detail, including
the retained-wallet case (an archived wallet the transaction already points
at stays selectable on edit only) and the rule that an expense cannot be
corrected below what its refunds return. This retires the last legacy
transaction spec, leaving the legacy `tests/e2e` with helpers only.

**Blocked by:** 09: Port transfers and refunds

**Status:** done

**Pattern to copy:**

- The edit page and delete button from legacy `features/transactions`; the
  form's edit mode from the component copied in ticket 07; `PUT` and
  `DELETE` through `useApiMutation` (delete needs no idempotency key only if
  the API does not require one; follow the OpenAPI document).
- Invalidate history, detail, wallet, and report queries after a correction
  so balances re-read.

**Out of scope:** change history display (never user-facing); bulk edits;
undo.

- [x] Editing amount, date, category, description, or wallet saves and is reflected in detail, history, and wallet balances.
- [x] A transaction on an archived wallet keeps that wallet selectable on edit and labels it Archived; new entries still cannot pick it.
- [x] Correcting an expense below its refunds is rejected with the server's message, values preserved.
- [x] Delete confirms, removes the transaction, and returns to history with balances updated.
- [x] `transactions.spec.ts` is ported one for one (its entry scenarios may fold into `transaction-entry.spec.ts`) and passes on `phone-chromium`; the legacy copy is deleted and the legacy suite now contains only helpers.
- [x] `pnpm run ci` is green.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium transactions transaction-entry`.

## Comments

Ported the edit page to `/transactions/$transactionId/edit` (a sibling route,
`$transactionId_.edit.tsx`, as the refund route is) and the delete button in
the edit form's footer, where the legacy screen keeps it. The loader ensures
the transaction, wallets, and categories, plus a refund's expense and that
expense's refunds, or an expense's own refunds; the page splits by link kind
so every suspense read is unconditional. The API-to-form mapping lives in
`features/transactions/editable-transaction.ts` (with a unit test) so the
route stays thin. `toWalletOptions` gained a
`retainedWalletIds` option so an archived wallet the transaction already
points at stays selectable, labelled Archived, on edit only. `linked-expense`
gained the `editingRefund` option ticket 09 deferred: the API's `remaining`
plus the edited refund's own amount, as legacy did.

`useTransactionForm` now corrects through `PUT /v1/transactions/{id}` via
`useApiMutation` (no idempotency key: the OpenAPI document defines none, and
an update that changes nothing succeeds, so the helper's replay is safe).
The `below-refunded` and `after-refund` 422 codes are worded from the loaded
refunds read (`refundedTotal`, earliest refund date), as 09 did for
`exceeds-refundable`; nothing is recomputed. The delete button sends
`DELETE`, words a 409 `refunds-exist` from the problem's `refunds` extension,
treats a 404 as already done, and navigates to `/transactions?deleted=1`.

Invalidation moved to `features/transactions/transaction-reads.ts`: one
predicate over the `/v1/transactions`, `/v1/wallets`, `/v1/reports` paths and
category usage, used by save, correct, and delete. A deletion leaves the
deleted record's own detail and refunds reads out of the refetch (they would
only answer 404 while the page is still mounted, and the default retries held
the dialog for seconds) and removes them once the list is shown.

Deviations:

- The history `deleted` search param is now a numeric flag (`1`) in
  `historySearchSchema`: the router writes validated search back to the
  address, and a string `"1"` came out JSON-quoted (`?deleted=%221%22`);
  the number reproduces the legacy `?deleted=1`.
- The detail page's Edit anchor became a router `Link`.
- The first ported scenario also changes the category, which the ticket's
  first criterion names and the legacy scenario did not exercise.
- The legacy entry scenarios were not folded in: `transaction-entry.spec.ts`
  (07) already covers quick entry, validation, no wallet, and Bangkok
  midnight; `history.spec.ts` (08) the detail's Recorded line; and the
  lost-response replay is exercised in `transfers.spec.ts` (09). The ported
  edit/delete scenarios read the detail's `dl` for the recorded time (the
  address changes before the detail renders) and assert the `DELETE` answers
  204 instead of the Next.js action redirect header. A third scenario covers
  the retained archived wallet, `below-refunded`, the blocked delete, and
  editing a refund against its allowance.

Verification: `pnpm run ci` green; `transactions.spec.ts` (3 tests) and
`transaction-entry.spec.ts` (5 tests) passed on `phone-chromium`.
