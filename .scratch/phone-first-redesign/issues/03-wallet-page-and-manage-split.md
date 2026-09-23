# 03: Wallet page and the `/manage` split

Read `../spec.md` first (Wallet page and management).

**What to build:** Tapping a wallet opens that wallet's page: its current
balance as the display figure and its transactions, so the account holder can
reconcile one wallet. Management (opening correction, archive, delete) moves
one level down behind Manage and works exactly as before.

**Blocked by:** 01 (Shell: tab bar, desktop header, title bar and standalone chrome)

**Status:** ready-for-agent

**Out of scope:** ＋ pre-filling the wallet from this page (04); any change to
what wallet management does. No API change: the transaction list already
filters by wallet.

- [ ] Wallet rows on the Wallets screen link to `/wallets/$id`, the wallet page.
- [ ] The wallet page shows the wallet name as the h1, the current balance as the display figure (Step-Down treatment), and its type and Archived state in Caption.
- [ ] Beneath, the wallet's transactions appear in the history-row form, pre-filtered to this wallet, with the older-page link when there are more.
- [ ] The wallet page keeps the tab bar, shows ‹ back to Wallets, and has Manage in its title bar (beside the h1 on desktop).
- [ ] `/wallets/$id/manage` shows today's management screen unchanged; it is a form screen (tab bar hidden) and its back goes to the wallet page.
- [ ] After deleting a wallet, the app lands on Wallets; after other management actions, it stays where it does today.
- [ ] Archived wallets keep their figures and Archived label on the list and on their page.
- [ ] The wallets and wallet-lifecycle browser specs follow the new path: row → wallet page → Manage.

**Verify:** `pnpm run ci`, then the touched specs alone on `phone-chromium`.

## Comments
