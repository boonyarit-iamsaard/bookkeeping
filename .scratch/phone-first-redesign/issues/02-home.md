# 02: Home

Read `../spec.md` first (Home, Routes).

**What to build:** Opening the app lands on Home at `/`, which answers "how
much do I have, how is this month going, what did I just record" on one
screen: the total across wallets, this month's Income, Net expenses and Net,
and the ten most recent transactions.

**Blocked by:** 01 (Shell: tab bar, desktop header, title bar and standalone chrome)

**Status:** ready-for-agent

**Out of scope:** the avatar disc and sheet in Home's title bar (07); ＋
returning to Home with the new row faded in (04). No API change: the wallet
list, the monthly report and the transaction list with a limit already exist.

- [ ] `/` renders Home inside the signed-in layout instead of redirecting to Wallets; signed-out visitors still go to sign-in. The manifest `start_url` stays `/`.
- [ ] The total across wallets is the one display figure (Step-Down treatment), summed over the same wallets as the Wallets screen, archived included, with "Across N wallets" in Caption.
- [ ] A This month block shows Income, Net expenses and Net as three divided Row Figure rows for the current Bangkok month, and the block links to Reports for that month.
- [ ] Recent transactions shows the latest 10 in the history-row form, each opening its detail, followed by "All transactions →".
- [ ] With no wallets, Home shows only the existing empty state with Create wallet as the primary.
- [ ] With wallets but no transactions, Recent shows the Caption "No transactions yet" and the month rows show ฿0.00.
- [ ] While loading, Home shows neutral skeletons in its final layout, never sample money.
- [ ] The Home tab is current on `/`, and the desktop header's Home link is current.
- [ ] A Home browser spec covers the three sections with a fresh user's data, the no-wallet and no-transaction states, and the month block reaching Reports. The shell and PWA specs expect `/` to be Home, not a redirect to Wallets.

**Verify:** `pnpm run ci`, then the touched specs alone on `phone-chromium`.

## Comments
