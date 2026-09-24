# 12: Filter chips announce themselves as the current page

Read `../spec.md` first.

**What to build:** Removable filter chips stop reporting `aria-current="page"`, so a screen reader hears only "Remove filter KBank Savings".

**Blocked by:** None (can start immediately)

**Status:** done

**Out of scope:** changing what a chip does.

- [x] No chip under the Transactions title carries `aria-current` or the active class; the tab bar and header stay the only current-page markers.
- [x] The history browser spec asserts the chips have no `aria-current`.

## Comments

From 07's milestone critique (2026-09-24): P1, material (WCAG 4.1.2). Verified in the live page: both chips on `/transactions?type=expense&walletId=…` carry `aria-current="page"` because the TanStack `Link` in `apps/web/src/features/transactions/components/history-filters.tsx` matches `/transactions`. Likely fix: `activeOptions={{ exact: true, includeSearch: true }}` or drop the active props on chips.

Triaged (2026-09-24): in scope with the rest of 12–18, after 13.

Closed (2026-09-24):

- Built in 2182686. The chip `Link` now matches with
  `activeOptions={{ exact: true, includeSearch: true }}`; a chip's search
  always drops one filter the address carries, so it never matches and gets
  neither `aria-current` nor the active class. The tab bar and header keep
  their default matching.
- `pnpm run ci` passes. `history.spec.ts` passes on `phone-chromium`; its new
  assertion finds no `[aria-current]` or `.active` among five chips, and failed
  on all five before the fix.
