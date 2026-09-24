# 12: Filter chips announce themselves as the current page

Read `../spec.md` first.

**What to build:** Removable filter chips stop reporting `aria-current="page"`, so a screen reader hears only "Remove filter KBank Savings".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Out of scope:** changing what a chip does.

- [ ] No chip under the Transactions title carries `aria-current` or the active class; the tab bar and header stay the only current-page markers.
- [ ] The history browser spec asserts the chips have no `aria-current`.

## Comments

From 07's milestone critique (2026-09-24): P1, material (WCAG 4.1.2). Verified in the live page: both chips on `/transactions?type=expense&walletId=…` carry `aria-current="page"` because the TanStack `Link` in `apps/web/src/features/transactions/components/history-filters.tsx` matches `/transactions`. Likely fix: `activeOptions={{ exact: true, includeSearch: true }}` or drop the active props on chips.

Triaged (2026-09-24): in scope with the rest of 12–18, after 13.
