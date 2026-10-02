# 08: Final sweep and full matrix

Read `../design-brief.md` first (Outcome), then the current `DESIGN.md`.

**What to build:** The redesign's definition of done: every screen and state
is on the new system and `DESIGN.md` documents what shipped. This ticket
covers what no area ticket owns, catches drift between tickets that were
built separately, and runs the full browser matrix.

**Blocked by:** 02, 03, 04, 05, 06, 07

**Status:** ready-for-agent

- [ ] The static offline page is on the new system, in light and dark.
- [ ] The shared loading component (`HistoryLoading`) regains `aria-busy` and a screen-neutral `aria-label`, both dropped in 03 when it became shared (see 03's closing note).
- [ ] An invalid filter chip is distinguishable from a valid one, not by red alone, rather than relying only on the notice (deferred from 03).
- [ ] The loading hero skeleton's color is reconciled: the detail page's and Home's are Midnight-tinted while `DESIGN.md` says "Card-colored"; fix the code or the document so they agree (deferred from 03).
- [ ] "Bank account" no longer wraps to two lines in the new-wallet Type segment at 360px (deferred from 04).
- [ ] Code duplicated across screens is extracted or deliberately kept, with the choice recorded: the Amount field, the month list sections, and the hero skeleton (04's review), and the inline delete confirmation that Categories copied from Manage (deferred from 06).
- [ ] The category row's accessible name, which 06 widened to include "Protected" and the entry count to match its visible text, is recorded in `DESIGN.md` as an intended change, or reverted.
- [ ] On Reports, the per-wallet rows below the wallet bars repeat what the bars show (kept in 05 because tests read them); accept the repetition deliberately or merge the rows into the bar labels without changing what the tests assert.
- [ ] A cross-screen `/impeccable` audit finds no remaining screen, sheet, dialog, empty, loading, or error state on the old system, and its material drift fixes are applied.
- [ ] `DESIGN.md` and `.impeccable/design.json` match the shipped product, including every stated system change from 02–07.
- [ ] `pnpm run ci` passes.
- [ ] The full two-project SPA matrix passes.
- [ ] `pnpm run ci:e2e` passes against the production build.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** the full matrix and `ci:e2e` are exclusive runs under the local resource limits in `CLAUDE.md`: nothing else heavy runs alongside either, and they never run together. `ci:e2e` may need host execution.
