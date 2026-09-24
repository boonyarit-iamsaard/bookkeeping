# 16: Motion beyond the three feedback moments

Read `../spec.md` first.

**What to build:** Only the indicator slide, the arrival fade and the sheet slide move; popovers, selects, menus and chevrons appear without animating.

**Blocked by:** None (can start immediately)

**Status:** needs-triage

**Out of scope:** the three sanctioned moments themselves.

- [ ] Popover, Select and dropdown-menu content no longer slide or fade in (`apps/web/src/shared/components/ui/popover.tsx:50`, `select.tsx:120`, `dropdown-menu.tsx:54`), and chevrons no longer rotate over 200ms.
- [ ] The unused submenu content style in `dropdown-menu.tsx` (around line 160, which zooms and has no `motion-reduce`) is removed, as the Rule amendments already require.

## Comments

From 07's milestone critique (2026-09-24): P3, material (breaches the Motion rule amendment: three feedback moments only). Everything listed already stops under `prefers-reduced-motion` except the submenu style.
