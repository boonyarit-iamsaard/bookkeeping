# 16: Motion beyond the three feedback moments

Read `../spec.md` first.

**What to build:** Only the indicator slide, the arrival fade and the sheet slide move; popovers, selects, menus and chevrons appear without animating.

**Blocked by:** None (can start immediately)

**Status:** done

**Out of scope:** the three sanctioned moments themselves.

- [x] Popover, Select and dropdown-menu content no longer slide or fade in (`apps/web/src/shared/components/ui/popover.tsx:50`, `select.tsx:120`, `dropdown-menu.tsx:54`), and chevrons no longer rotate over 200ms.
- [x] The unused submenu content style in `dropdown-menu.tsx` (around line 160, which zooms and has no `motion-reduce`) is removed, as the Rule amendments already require.

## Comments

From 07's milestone critique (2026-09-24): P3, material (breaches the Motion rule amendment: three feedback moments only). Everything listed already stops under `prefers-reduced-motion` except the submenu style.

Triaged (2026-09-24): in scope with the rest of 12–18, after 13.

Closed (2026-09-24):

- Built in 0a463ae. Popover, Select and dropdown-menu content drop their
  slide, fade, duration and transform-origin classes, so they appear and
  disappear at once. The Select, date, month and icon-picker chevrons still
  flip while open but no longer turn over 200ms. `DropdownMenuSubContent` keeps
  only its placement defaults; its zooming style is gone.
- `pnpm run ci` passes, and so does `history.spec.ts` on `phone-chromium`.
- Still moving outside the three moments: the delete dialog (ticket 17) and the
  1px press nudge on `button.tsx`, which animates through `transition-all` and
  isn't guarded by `motion-reduce`.
