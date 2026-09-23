# 02: Home

Read `../spec.md` first (Home, Routes).

**What to build:** Opening the app lands on Home at `/`, which answers "how
much do I have, how is this month going, what did I just record" on one
screen: the total across wallets, this month's Income, Net expenses and Net,
and the ten most recent transactions.

**Blocked by:** 01 (Shell: tab bar, desktop header, title bar and standalone chrome)

**Status:** done

**Out of scope:** the avatar disc and sheet in Home's title bar (07); ＋
returning to Home with the new row faded in (04). No API change: the wallet
list, the monthly report and the transaction list with a limit already exist.

- [x] `/` renders Home inside the signed-in layout instead of redirecting to Wallets; signed-out visitors still go to sign-in. The manifest `start_url` stays `/`.
- [x] The total across wallets is the one display figure (Step-Down treatment), summed over the same wallets as the Wallets screen, archived included, with "Across N wallets" in Caption.
- [x] A This month block shows Income, Net expenses and Net as three divided Row Figure rows for the current Bangkok month, and the block links to Reports for that month.
- [x] Recent transactions shows the latest 10 in the history-row form, each opening its detail, followed by "All transactions →".
- [x] With no wallets, Home shows only the existing empty state with Create wallet as the primary.
- [x] With wallets but no transactions, Recent shows the Caption "No transactions yet" and the month rows show ฿0.00.
- [x] While loading, Home shows neutral skeletons in its final layout, never sample money.
- [x] The Home tab is current on `/`, and the desktop header's Home link is current.
- [x] A Home browser spec covers the three sections with a fresh user's data, the no-wallet and no-transaction states, and the month block reaching Reports. The shell and PWA specs expect `/` to be Home, not a redirect to Wallets.

**Verify:** `pnpm run ci`, then the touched specs alone on `phone-chromium`.

## Comments

Implemented on 2026-09-23. `pnpm run ci` passed; the Home, shell, auth,
wallets and dashboard specs passed alone on `phone-chromium`, and the PWA spec
passed against the production build (`pnpm test:e2e:ci`). Decisions made
during the build, for review:

- Sign-in and sign-up still land on Wallets, and a signed-in visit to the
  auth pages still redirects there. On phone the account menu (sign out)
  lives only in the Wallets title bar until 07's avatar sheet, so landing on
  Home now would hide it. 07 now has a checklist item to move both to `/`.
- The month block's link is named by its heading, "This month", with a
  chevron, and a stretched hit area makes the whole block tappable (no
  hover fill, per the Hairline rule). Net is
  semibold, as in the report. The link goes to `/dashboard?month=…` until 06
  renames it.
- "All transactions →" shows only when there are recent rows; with none, the
  Caption "No transactions yet" stands alone.
- The total now shares one sum (`wallet-total.ts`, unit-tested) and one
  display component with the Wallets screen, and the report uses the same
  sum.
- Moved to 06 as checklist items (review findings): Home reuses the transactions
  error screen, whose copy mentions filters; the month is derived with
  `slice(0, 7)` in Home and the report schema; Income, Net expenses and Net
  labels are repeated between Home and the report.
- Fixed a PWA bug the start-URL check exposed: the worker precached
  `index.html`, and Workbox's directory index answered `/` from it before the
  network-only navigation rule. An offline launch at the manifest's
  `start_url` booted a shell that failed ("Something went wrong!") instead of
  showing the offline page. `index.html` is no longer precached. The PWA spec
  now launches at `/` before going offline.
