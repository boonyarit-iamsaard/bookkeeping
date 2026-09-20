# 10: Port transaction corrections

Read `../worker-brief.md` first.

**What to build:** Editing a transaction at
`/transactions/$transactionId/edit` and deleting it from detail, including
the retained-wallet case (an archived wallet the transaction already points
at stays selectable on edit only) and the rule that an expense cannot be
corrected below what its refunds return. This retires the last legacy
transaction spec, leaving the legacy `tests/e2e` with helpers only.

**Blocked by:** 09: Port transfers and refunds

**Status:** ready-for-agent

**Pattern to copy:**

- The edit page and delete button from legacy `features/transactions`; the
  form's edit mode from the component copied in ticket 07; `PUT` and
  `DELETE` through `useApiMutation` (delete needs no idempotency key only if
  the API does not require one; follow the OpenAPI document).
- Invalidate history, detail, wallet, and report queries after a correction
  so balances re-read.

**Out of scope:** change history display (never user-facing); bulk edits;
undo.

- [ ] Editing amount, date, category, description, or wallet saves and is reflected in detail, history, and wallet balances.
- [ ] A transaction on an archived wallet keeps that wallet selectable on edit and labels it Archived; new entries still cannot pick it.
- [ ] Correcting an expense below its refunds is rejected with the server's message, values preserved.
- [ ] Delete confirms, removes the transaction, and returns to history with balances updated.
- [ ] `transactions.spec.ts` is ported one for one (its entry scenarios may fold into `transaction-entry.spec.ts`) and passes on `phone-chromium`; the legacy copy is deleted and the legacy suite now contains only helpers.
- [ ] `pnpm run ci` is green.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium transactions transaction-entry`.
