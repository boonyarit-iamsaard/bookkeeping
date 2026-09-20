# 09: Port transfers and refunds

Read `../worker-brief.md` first.

**What to build:** Transfer entry between a source and destination wallet
on the existing form, refund entry from an expense at
`/transactions/$transactionId/refund`, and the refund panel on the expense
detail showing its refunds and the refund allowance. Legacy transfer and
refund specs are retired.

**Blocked by:** 08: Port transaction history and detail

**Status:** ready-for-agent

**Pattern to copy:**

- The transfer and refund branches already present in the form copied in
  ticket 07; the legacy `expense-refunds` component; the refunds read as
  query options.
- Refund page loads the original expense and its refunds, and submits a
  linked refund through `useApiMutation`; the refund allowance is displayed
  from the API, never computed in the client.

**Out of scope:** edit and delete (10); multi-wallet or scheduled transfers;
any client-side recomputation of allowance or balances.

- [ ] A transfer saves with From and To wallets and shows as a transfer (→) in history and on both wallet balances.
- [ ] A refund saves against an expense, appears in the expense's refund panel, and reduces the allowance shown there.
- [ ] A refund above the allowance is rejected with the server's message, values preserved.
- [ ] Archived wallets are not offered for new transfers or refunds.
- [ ] `transfers.spec.ts` and `refunds.spec.ts` are ported one for one and pass on `phone-chromium`; the legacy copies are deleted.
- [ ] `pnpm run ci` is green.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium transfers refunds`.
