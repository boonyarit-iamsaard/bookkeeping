# 04: Balance over time: compare one wallet

Read `../spec.md` first. It is the spec; do not reopen its decisions.

**What to build:** The owner can see how one wallet moved against the total.
A wallet picker in Balance over time lists every wallet, archived ones
labeled "· Archived", with none selected by default. Choosing one draws its
daily Closing balance as a second line in the next chart hue with a hatched
dash, starting on its opening date; the selected-day readout and the hidden
table gain its figure. Only one wallet line shows at a time.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The closing-balances read accepts an optional `walletId` and returns that wallet's Closing balance per entry, null before its opening date; the OpenAPI schema and generated client follow
- [ ] A wallet the owner does not own is a not-found problem, like other owner-scoped reads
- [ ] Route integration tests: the wallet figure matches the wallet collection's as-of balance on each date; null before its opening date; an archived wallet works; a transfer moves the wallet line but not the total; a foreign wallet id is rejected
- [ ] The derivation adds the wallet series with its own gaps; unit tested
- [ ] The picker has 44px targets on phone and is keyboard and screen reader operable; clearing it returns to the total alone
- [ ] `pnpm run ci` passes, and the focused Reports browser case still passes on one project
