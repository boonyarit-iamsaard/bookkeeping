# 04: Balance over time: compare one wallet

Read `../spec.md` first. It is the spec; do not reopen its decisions.

**What to build:** The owner can see how one wallet moved against the total.
A wallet picker in Balance over time lists every wallet, archived ones
labeled "· Archived", with none selected by default. Choosing one draws its
daily Closing balance as a second line in the next chart hue with a hatched
dash, starting on its opening date; the selected-day readout and the hidden
table gain its figure. Only one wallet line shows at a time.

**Blocked by:** 03

**Status:** done

- [x] The closing-balances read accepts an optional `walletId` and returns that wallet's Closing balance per entry, null before its opening date; the OpenAPI schema and generated client follow
- [x] A wallet the owner does not own is a not-found problem, like other owner-scoped reads
- [x] Route integration tests: the wallet figure matches the wallet collection's as-of balance on each date; null before its opening date; an archived wallet works; a transfer moves the wallet line but not the total; a foreign wallet id is rejected
- [x] The derivation adds the wallet series with its own gaps; unit tested
- [x] The picker has 44px targets on phone and is keyboard and screen reader operable; clearing it returns to the total alone
- [x] `pnpm run ci` passes, and the focused Reports browser case still passes on one project

Closed by d6a31a5: `GET /v1/reports/closing-balances` takes an optional `walletId` (a malformed id is a bad request, one the owner does not hold is not found), and Balance over time gains a "Compare a wallet" picker that draws the wallet as a dashed chart 2 line on the total's scale. The comparison is page state, not part of the address, and holds across months.
