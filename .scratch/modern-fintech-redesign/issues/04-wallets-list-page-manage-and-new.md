# 04: Wallets: list, wallet page, manage and new

Read `../design-brief.md` first, then the `DESIGN.md` written by 01.

**What to build:** Checking and managing wallets happens on the new system.
The Wallets screen shows wallet cards with type, Archived status and
balance; the wallet page leads with a balance card and lists that wallet's
transactions; Manage (rename, archive and unarchive, delete with its inline
confirmation) and the new-wallet form are in 01's language, in light and
dark.

**Blocked by:** 01 (Foundation: system, shell and Home)

**Status:** ready-for-agent

**Out of scope:** each wallet's share of the total as a chart (05).

- [ ] The Wallets screen shows one card per wallet, from one to about ten, including archived wallets with their Archived status; long names and negative balances hold their layout at 360px.
- [ ] The wallet page leads with its current balance card and lists the wallet's transactions with 01's row.
- [ ] Manage is on the new system, including the archive and unarchive actions and the inline delete confirmation; destructive styling is not carried by red alone.
- [ ] The new-wallet form, including the dated opening balance, is on the new system.
- [ ] The Wallets empty state and the wallet page's loading and error states use 01's patterns.
- [ ] An arriving wallet or transaction still announces itself, with motion removed under reduced motion.
- [ ] `DESIGN.md` changes only through a stated system change, recorded in this ticket's closing comment.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** `pnpm run ci`, then the wallets spec alone on one project (`phone-chromium`). Follow the local resource limits in `CLAUDE.md`.
