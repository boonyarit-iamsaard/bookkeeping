# 08: Final sweep and full matrix

Read `../design-brief.md` first (Outcome), then the current `DESIGN.md`.

**What to build:** The redesign's definition of done: every screen and state
is on the new system and `DESIGN.md` documents what shipped. This ticket
covers what no area ticket owns, catches drift between tickets that were
built separately, and runs the full browser matrix.

**Blocked by:** 02, 03, 04, 05, 06, 07

**Status:** ready-for-agent

- [x] The static offline page is on the new system, in light and dark.
- [x] The shared loading component (`HistoryLoading`) regains `aria-busy` and a screen-neutral `aria-label`, both dropped in 03 when it became shared (see 03's closing note).
- [x] An invalid filter chip is distinguishable from a valid one, not by red alone, rather than relying only on the notice (deferred from 03).
- [x] The loading hero skeleton's color is reconciled: the detail page's and Home's are Midnight-tinted while `DESIGN.md` says "Card-colored"; fix the code or the document so they agree (deferred from 03).
- [x] "Bank account" no longer wraps to two lines in the new-wallet Type segment at 360px (deferred from 04).
- [x] Code duplicated across screens is extracted or deliberately kept, with the choice recorded: the Amount field, the month list sections, and the hero skeleton (04's review), and the inline delete confirmation that Categories copied from Manage (deferred from 06).
- [x] The category row's accessible name, which 06 widened to include "Protected" and the entry count to match its visible text, is recorded in `DESIGN.md` as an intended change, or reverted.
- [x] On Reports, the per-wallet rows below the wallet bars repeat what the bars show (kept in 05 because tests read them); accept the repetition deliberately or merge the rows into the bar labels without changing what the tests assert.
- [x] A cross-screen `/impeccable` audit finds no remaining screen, sheet, dialog, empty, loading, or error state on the old system, and its material drift fixes are applied.
- [x] `DESIGN.md` and `.impeccable/design.json` match the shipped product, including every stated system change from 02–07.
- [x] `pnpm run ci` passes.
- [ ] The full two-project SPA matrix passes.
- [ ] `pnpm run ci:e2e` passes against the production build.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** the full matrix and `ci:e2e` are exclusive runs under the local resource limits in `CLAUDE.md`: nothing else heavy runs alongside either, and they never run together. `ci:e2e` may need host execution.

## Sweep note (Part 1)

`/code-review` of 07's commit (`de3ab82`) found no standards breach and no spec
gap; its one smell (the two auth forms repeat the card-spacing and title
classes) is kept: two small class strings do not earn a component.

Extract-or-keep, chosen deliberately:

- **Hero skeleton: extracted** as `HeroSkeleton` (four copies). It stays
  Midnight-tinted, so nothing changes color when the figure arrives;
  `DESIGN.md` now says so instead of "Card-colored".
- **Amount field: extracted** as `AmountInput` for the capture form and the
  new-wallet form (identical chrome). Manage's smaller opening-balance field is
  kept apart: another size, no THB suffix, no shared error wiring.
- **Month list sections: extracted** as `MonthSections` (history and wallet page).
- **Inline delete confirmation: extracted** as `ConfirmPanel` (Manage and
  Categories).

Recorded in `DESIGN.md` as intended changes: 07's credential error as an Error
Notice, and 06's category row name including "Protected" and the entry count.
Reports' per-wallet rows under the bars are kept deliberately (bars are marks;
the rows are the exact text). `HistoryLoading` and the other loading screens
get `aria-busy` and a neutral "Loading" label through `Page`'s `loading`. An
invalid filter chip has a dashed outline, a triangle-alert and a hidden note.
"Bank account" fits one line at 360px (13px label, 2px inset, phone only).
`apps/web/.tanstack/` is ignored. The offline page was already on the new
system (checked in light and dark).

The cross-screen audit (detector clean; every route, sheet, dialog, empty,
loading and error state, and the offline page, measured at 360px and 1280px in
light and dark for overflow, 44px targets, contrast and fonts) found four material
drifts, all fixed in one batch: Signal Red text was 4.19:1 on its own 10% tint
(light red darkened to `oklch(0.5 0.2 25)`); Reports scrolled sideways at 360px
because the trend's hidden table ignored its `sr-only` clip; the trend's month
buttons were 43px wide; an unknown address showed a bare "Not Found" (now an
empty-state card with Go to Home). The confirmation round was clean. The pane's
captures came back tiled or timed out, so the audit used measurements, not
pictures. `DESIGN.md` and `.impeccable/design.json` are in line, `pnpm run ci` passes.
