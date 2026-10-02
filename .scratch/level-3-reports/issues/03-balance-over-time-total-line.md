# 03: Balance over time: total line

Read `../spec.md` first. It is the spec; do not reopen its decisions. Also
read `CONTEXT.md` (**Closing balance**), ADR 0001, and the balance trend under
"Level 3" in `DESIGN.md`'s Charts section.

**What to build:** Reports shows how the owner's money moved through the
chosen month. A Balance over time section after Wallet balances draws the
balance trend: the daily total Closing balance across all wallets, archived
included, from a new server read, `GET /v1/reports/closing-balances?month=YYYY-MM`.
The read returns one entry per date from the month's first day through its
last day or today (Bangkok), whichever is earlier; a date before every
wallet's opening date carries null, and a future month returns no entries.
The line starts on the earliest opening date and stops at today. The selected
day starts at the Balance date when it falls in the month, otherwise at the
last entry; its exact figure is read out, and a hidden table carries every
day. The zero line is drawn when any balance in view is negative. No wallets,
or a month entirely before every opening date, shows one line of text; a
future month says there is nothing yet; loading shows a skeleton.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The read reuses the monthly report's month query schema, is owner-scoped from the session, and has its own named OpenAPI schema; the generated web client is regenerated
- [x] Route integration tests: each day's total equals the sum of the wallet collection's as-of balances on that date; a transfer leaves the total unchanged; archived wallets count; null before the earliest opening date; entries stop at today; a future month is empty; month validation and authentication problems match the monthly report
- [x] A pure derivation turns the response into the line series with gaps for nulls, zero-line detection, and the default selected day; unit tested like the existing trend series
- [x] The section uses the DESIGN.md balance trend exactly, works at 360px, and the selected day can be changed by pointer and keyboard
- [x] Empty, future and loading states as described
- [x] One focused browser case in the existing Reports spec on one project shows the line and readout for a month with data and the empty state otherwise
- [x] `pnpm run ci` passes

Closed by fa76bd3: `GET /v1/reports/closing-balances`, the balance trend derivation, and the Balance over time section. The plot spans the month's lowest to highest balance and reaches zero only when a balance is negative; the selected day moves by pointer or the plot's slider keys.
