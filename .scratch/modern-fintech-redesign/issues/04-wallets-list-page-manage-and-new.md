# 04: Wallets: list, wallet page, manage and new

Read `../design-brief.md` first, then the `DESIGN.md` written by 01.

**What to build:** Checking and managing wallets happens on the new system.
The Wallets screen shows wallet cards with type, Archived status and
balance; the wallet page leads with a balance card and lists that wallet's
transactions; Manage (rename, archive and unarchive, delete with its inline
confirmation) and the new-wallet form are in 01's language, in light and
dark.

**Blocked by:** 01 (Foundation: system, shell and Home)

**Status:** done

**Out of scope:** each wallet's share of the total as a chart (05).

- [x] The Wallets screen shows one card per wallet, from one to about ten, including archived wallets with their Archived status; long names and negative balances hold their layout at 360px.
- [x] The wallet page leads with its current balance card and lists the wallet's transactions with 01's row.
- [x] Manage is on the new system, including the archive and unarchive actions and the inline delete confirmation; destructive styling is not carried by red alone.
- [x] The new-wallet form, including the dated opening balance, is on the new system.
- [x] The Wallets empty state and the wallet page's loading and error states use 01's patterns.
- [x] An arriving wallet or transaction still announces itself, with motion removed under reduced motion.
- [x] `DESIGN.md` changes only through a stated system change, recorded in this ticket's closing comment.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** `pnpm run ci`, then the wallets spec alone on one project (`phone-chromium`). Follow the local resource limits in `CLAUDE.md`.

## Closing note

### 2026-10-02: done

Built in `68585c9`. Wallets keeps the Total balance hero and lists one wallet
card per wallet, one column on phone and two from 640px: a type tile on Iris
Tonal (Mist for an archived wallet, whose caption still says Archived), the
name wrapping rather than truncating, the type and opening date, and the
balance in Figure Net at the card's foot. The wallet page leads with its
Midnight hero and lists its transactions as 03's month list sections of 01's
rows. Manage is one card per task, with deletion set further apart, a
Destructive Delete wallet… with a trash pictogram, and an inline confirmation
on a Mist panel led by a triangle-alert. The new-wallet form is two Form
Cards with the opening balance as the form's figure and the Chrome Save bar.

Stated system changes, all recorded in `DESIGN.md`:

- **Wallets**: new component section for the wallet card and Wallet Tile,
  the wallet page, Manage and its inline delete confirmation, and the
  new-wallet form.
- **Saved Notice**: the Iris Tonal "done" card is now one shared component
  (`SavedNotice`), used by Manage and by history's "Transaction deleted."
  notice.
- **List sections** take a heading `level`; the wallet page's month headings
  are level 3 under a visually hidden "Transactions" heading.
- **Motion**: the arriving wallet card joins the arriving row (400ms
  rise-and-fade, a 7% Iris wash that stays under reduced motion).
- **Skeletons**: a wallet page's loading shape (`WalletPageLoading`), which
  replaces its use of `HistoryLoading`.
- The Scope paragraph now names 04 as done.

Carry-over from 03, in its own commit `7bbe620`: at 1280px the filter
sheet's Wallet and Category lists matched their 192px triggers, so long
wallet names truncated and an archived wallet lost its "· Archived" mark.
Options now wrap. History, month groups, paging and the filter sheet were
otherwise sound at 1280px in light and dark.

Left for later: at 360px "Bank account" wraps to two lines in the new-wallet
Type segment now that the field sits on a card; the hero skeleton is still
Midnight-tinted while `DESIGN.md` says "Card-colored" (03's note, final
sweep); review suggested sharing the Amount field, the month sections and
the hero skeleton across screens, which belongs to the final sweep.

Verified: `pnpm run ci` passes; `wallets.spec.ts` (4 passed),
`wallet-lifecycle.spec.ts` (3 passed) and `transactions.spec.ts` (4 passed)
pass on `phone-chromium`. No browser test needed its dates paged. Inspected
at 360px and 1280px in light and dark on a throwaway local database with
placeholder data: one wallet and ten, an archived wallet, a negative balance,
a long name, Manage with the inline delete confirmation, the new-wallet form,
and an arriving wallet. The preview pane draws 1280px captures scaled down
rather than clipping them, so desktop was captured section by section.
`/code-review` found no breach of a documented standard and no spec gap; its
fixes (shared `SavedNotice`, `WalletTile` in its own file, Manage's balance
card on the shared card class, the ฿ prefix recorded) are in the commit.
