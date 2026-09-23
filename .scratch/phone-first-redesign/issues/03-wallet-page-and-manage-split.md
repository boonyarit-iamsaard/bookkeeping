# 03: Wallet page and the `/manage` split

Read `../spec.md` first (Wallet page and management).

**What to build:** Tapping a wallet opens that wallet's page: its current
balance as the display figure and its transactions, so the account holder can
reconcile one wallet. Management (opening correction, archive, delete) moves
one level down behind Manage and works exactly as before.

**Blocked by:** 01 (Shell: tab bar, desktop header, title bar and standalone chrome)

**Status:** done

**Out of scope:** ＋ pre-filling the wallet from this page (04); any change to
what wallet management does. No API change: the transaction list already
filters by wallet.

- [x] Wallet rows on the Wallets screen link to `/wallets/$id`, the wallet page.
- [x] The wallet page shows the wallet name as the h1, the current balance as the display figure (Step-Down treatment), and its type and Archived state in Caption.
- [x] Beneath, the wallet's transactions appear in the history-row form, pre-filtered to this wallet, with the older-page link when there are more.
- [x] The wallet page keeps the tab bar, shows ‹ back to Wallets, and has Manage in its title bar (beside the h1 on desktop).
- [x] `/wallets/$id/manage` shows today's management screen unchanged; it is a form screen (tab bar hidden) and its back goes to the wallet page.
- [x] After deleting a wallet, the app lands on Wallets; after other management actions, it stays where it does today.
- [x] Archived wallets keep their figures and Archived label on the list and on their page.
- [x] The wallets and wallet-lifecycle browser specs follow the new path: row → wallet page → Manage.

**Verify:** `pnpm run ci`, then the touched specs alone on `phone-chromium`.

## Comments

Implemented on 2026-09-23. `pnpm run ci` passed; the wallets,
wallet-lifecycle, shell, dashboard, refunds, transactions and transfers specs
passed alone on `phone-chromium`. Decisions made during the build, for review:

- Routes follow the transaction routes' flat convention:
  `wallets/$walletId.tsx` is the wallet page and `$walletId_.manage.tsx` the
  management screen, so management does not render inside the wallet page.
- The wallet page reuses history's rows (`TransactionList`), the loading
  skeleton and error screen, and history's `cursor` search value. With no
  transactions it shows the Caption "No transactions yet", as Home does,
  rather than history's empty state with its own Record button.
- Manage is an outline button with the Lucide sliders icon, like Edit on
  transaction detail. Management's back is named "Back to" and the wallet name.
- The wallet row's name link now stretches over the whole row, as Home's
  month block does; its accessible name stays the wallet's name.
- "Unarchive" links on the refund screen and the refund form now go
  to `/wallets/$id/manage`, where unarchiving lives; the report's balance
  rows link to the wallet page.
- The dashboard, refunds, transactions, transfers and shell specs reached
  archiving through the row, so each now also taps Manage.
- The older-page link is not covered by a browser test: a wallet page needs
  more than 50 transactions to show it, and it is the history's own link
  with the wallet fixed.
- Review follow-ups: the wallet page's balance and the wallets total now share
  one `DisplayFigure` (`shared/components/display-figure.tsx`). The wallet
  page borrows history's error screen and skeleton, like Home; the error copy
  is folded into 06's existing checklist item. DESIGN.md's wallet management
  section still names the old route; 08 rewrites it.
- The list and the wallet page caption a wallet with one `walletCaption`
  ("Cash · Archived"), unit-tested. The list's loose "Archived ·" span, which
  sat on its own line with a dangling dot, is gone. Management's "Current
  balance · Archived" stays as it was.
