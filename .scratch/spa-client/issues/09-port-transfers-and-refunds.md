# 09: Port transfers and refunds

Read `../worker-brief.md` first.

**What to build:** Transfer entry between a source and destination wallet
on the existing form, refund entry from an expense at
`/transactions/$transactionId/refund`, and the refund panel on the expense
detail showing its refunds and the refund allowance. Legacy transfer and
refund specs are retired.

**Blocked by:** 08: Port transaction history and detail

**Status:** done

**Pattern to copy:**

- The transfer and refund branches already present in the form copied in
  ticket 07; the legacy `expense-refunds` component; the refunds read as
  query options.
- Refund page loads the original expense and its refunds, and submits a
  linked refund through `useApiMutation`; the refund allowance is displayed
  from the API, never computed in the client.

**Out of scope:** edit and delete (10); multi-wallet or scheduled transfers;
any client-side recomputation of allowance or balances.

- [x] A transfer saves with From and To wallets and shows as a transfer (→) in history and on both wallet balances.
- [x] A refund saves against an expense, appears in the expense's refund panel, and reduces the allowance shown there.
- [x] A refund above the allowance is rejected with the server's message, values preserved.
- [x] Archived wallets are not offered for new transfers or refunds.
- [x] `transfers.spec.ts` and `refunds.spec.ts` are ported one for one and pass on `phone-chromium`; the legacy copies are deleted.
- [x] `pnpm run ci` is green.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium transfers refunds`.

## Comments

Ported transfer entry (the form's copied transfer branch, now exercised),
refund entry at `/transactions/$transactionId/refund`, and the refund panel
on the expense detail. The refund route lives in `$transactionId_.refund.tsx`
(trailing underscore) so it is a sibling of the detail route rather than a
child: the detail page renders no `Outlet`, and a nested child left the
address changed but the detail on screen. The detail loader ensures the
refunds read for expenses only; the refund loader ensures the expense, its
refunds, wallets, and categories, and answers a non-expense with the router's
`notFound`. `linked-expense.ts` is copied from legacy without the
`editingRefund` option, which ticket 10 adds; the allowance comes from the
API's `remaining` and is never recomputed. The `exceeds-refundable` field
error is worded from that same API allowance, as the legacy action did from
the rule's `remaining`, because the 422 carries only a code (as for every
transaction field error, which the client's message table words); if the
allowance changed since the page loaded, the figure named is the loaded one.
The linked expense chip is a router `Link`, and the amount field selects its
prefilled text on focus in refund mode, as legacy did. A saved refund also
invalidates its expense's detail and refunds reads so the panel shows the new
allowance without a refetch on mount. `toWalletOptions`, identical in the
entry and refund routes, moved to `features/transactions/wallet-options.ts`.

Deviations in the ported specs:

- Edit and delete steps of both legacy specs are left for ticket 10, which
  ports those routes; the transfer's balance assertions read the created
  transfer instead of the edited one, and the refund spec reaches "Fully
  refunded" by recording the rest of the allowance instead of editing a
  refund.
- The legacy "lost response" step intercepted the Next.js Server Action and
  clicked "Check and retry save". The SPA write helper replays the same
  `Idempotency-Key` on its own, so the spec drops the first `POST
/v1/transactions` response after the server commits and asserts the
  replay lands on the single created transfer.
- Both specs add the archived-wallet exclusion the ticket asks for (an
  archived "Old" wallet is absent from From and To; the archived original is
  absent from "Received in", as legacy already checked). The Select list must
  be open before Escape is pressed, because Escape inside the form cancels it,
  as in legacy.
- The `*_SCREENSHOTS` review captures and the `phone` project viewport setup
  are dropped; the SPA projects set their own viewports.

Verification: `pnpm run ci` green; `transfers.spec.ts` (2 tests) and
`refunds.spec.ts` (1 test) passed on `phone-chromium`.
