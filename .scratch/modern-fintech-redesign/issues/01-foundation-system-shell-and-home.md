# 01: Foundation: system, shell and Home

Read `../design-brief.md` first. It is the spec; do not reopen its decisions.
Also read `PRODUCT.md` (Brand Commitments) and the incumbent `DESIGN.md`,
which this ticket replaces.

**What to build:** The new visual world, defined on Home. Opening the app on
a phone or desktop, in light or dark following the system setting, shows the
new shell and a finished Home: a hero balance card, This month, and recent
transactions with colored category pictograms. Every shared primitive is on
the new system, so later tickets compose screens rather than invent parts.

Build it with `/impeccable` as a new visual world, code-first: write the
direction contract, build, run the finish review and fix what it returns,
then write the new `DESIGN.md` and `.impeccable/design.json` from the built
result.

**Blocked by:** None (can start immediately). Blocks every other ticket.

**Status:** ready-for-agent

**Out of scope:** the chart component and Home's level 1 chart (05); define
only the chart color tokens here. Area screens beyond Home (02–07), except
where a shared primitive restyles them as a side effect.

- [ ] Light and dark design tokens, following the system setting, with a soft tinted ground and card surfaces; the PWA `theme-color` follows the active scheme.
- [ ] The sans money treatment: bold proportional figures with tabular digits replace JetBrains Mono; always `฿12,000.00` with a true minus sign, never rounded; holds from `฿0.00` to seven figures and for negative balances.
- [ ] The app icon (`apps/web/public/icon.svg`, still the old cobalt "B" disc) redrawn in the new world, then the PWA icons regenerated with `pnpm --filter @bookkeeping/web generate:icons`; it stays the Bookkeeping name's own mark, with no borrowed bank marks.
- [ ] Card and surface primitives (hero card, grouped list section) on the new system.
- [ ] Every component in the shared UI component folder (button, card, input, field, label, select, popover, dropdown menu, calendar, segmented control, separator, sheet) and the shared date picker, month picker, money and display-figure components restyled. The sheet change carries every bottom sheet and dialog frame.
- [ ] The phone tab bar and title bar, the desktop header, and the account sheet and menu on the new system.
- [ ] The shared page error (`LoadError`), the empty-state pattern, and the skeleton pattern, used by Home's empty, loading and error states. Loading never shows sample money.
- [ ] The transaction row, as rendered by Home, history and the wallet page, with its category pictogram in the category color.
- [ ] Parent-category color: a fixed palette of about eight, chosen stably from the parent category's id, client-side; child categories inherit their parent's color. One unit-tested helper maps a category id to its color using the existing categories list read, which Home, history and the wallet page await in their loaders so rows never render uncolored. Awaiting that read is an accepted loading change inside this visual-only redesign: the list is small and usually already cached. No schema change, no user choice.
- [ ] Chart color tokens for light and dark, designed alongside the category palette, for 05 to use.
- [ ] Home finished: hero balance card with "Across N wallets", This month (Income, Net expenses, Net) linking to Reports, recent transactions with All transactions →, the no-wallet state, and the wallets-without-transactions state.
- [ ] Long wallet and category names hold their layout at 360px.
- [ ] Direction contract written; finish review run and its material fixes applied.
- [ ] New `DESIGN.md` and `.impeccable/design.json` written from the built result, replacing the "Statement of Holdings" system.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** `pnpm run ci`, then the Home spec alone on one project (`phone-chromium`). Follow the local resource limits in `CLAUDE.md`.
