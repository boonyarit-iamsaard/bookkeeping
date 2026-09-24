# 13: The history row's date is clipped on phone

Read `../spec.md` first.

**What to build:** At 360px a history row always shows its financial date in full; the wallet and note may give way, the date may not.

**Blocked by:** None (can start immediately)

**Status:** done

**Out of scope:** the row's type words, signs, amounts and refund link, which stay as the spec describes.

- [x] On Home, Transactions and a wallet page at 360px, every row's financial date is fully visible (no ellipsis), and the note is either visible or reachable.
- [x] On a wallet's own page the row does not repeat that wallet's name.

## Comments

From 07's milestone critique (2026-09-24): P1, material (content clipped at 360px). `apps/web/src/features/transactions/components/transaction-list.tsx:84` renders "Wallet · Date · Note" on one `truncate` line; at 360px the line gets 140–183px, so "KBank Savings · 24 Sep 2026 · September salary" shows as "KBank Savings · 24…" and notes almost never show. Both the design review and the detector's text-overflow rule flagged it. Options: the date on its own line, or wrap instead of truncate.

Triaged (2026-09-24): in scope with the rest of 12–18; 13 goes first.

Closed (2026-09-24):

- Built in f21bec5. The row's second line is now the date, then " · wallet",
  which truncates while the date keeps its width; the note has its own line,
  clamped to two lines, with the rest on the detail page. A wallet page passes
  `pageWalletId`, so its rows leave out the wallet name, and transfers read
  "To X" or "From X".
- `pnpm run ci` passes. The new `transactions.spec.ts` test passes alone on
  `phone-chromium`. It checks Home, Transactions and a wallet page at 360px.
  It also fails when the date is allowed to shrink, which confirms it catches
  the clipping.
