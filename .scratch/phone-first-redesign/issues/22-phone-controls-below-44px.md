# 22: Phone controls below the 44px target

Read `../spec.md` first (Rule amendments, Further Notes).

**What to decide:** The shipped redesign gives the high-reach phone controls
44px targets, but some other phone controls remain 36px or 40px. Decide whether
the 44px direction applies to every phone control and, if so, bring the
remaining controls into line.

**Blocked by:** None

**Status:** done

**Evidence:** Ticket 08's documenter found the empty-wallet and
empty-transaction primary actions still use `buttonVariants({ size: "lg" })`
(40px), while the button primitive's default and icon sizes remain 36px.
`DESIGN.md` records the shipped range rather than claiming these are already
44px.

- [x] Inventory phone uses of the 36px and 40px button sizes.
- [x] Decide whether every phone control or only high-reach controls must be
      at least 44px.
- [x] If the universal rule stands, update the controls and focused browser
      coverage, then refresh `DESIGN.md` and `.impeccable/design.json`.

## Inventory

Read-only source inventory on 2026-09-24 (paths below are under
`apps/web/src/`; rendered dimensions still need browser verification):

- Authentication inputs and submit buttons: 36px (`features/auth/components/`
  and `shared/components/ui/input.tsx`).
- Empty-wallet, empty-transaction and Reports create actions, plus Record
  refund: 40px (`wallet-list.tsx`, `transaction-list.tsx`,
  `financial-report.tsx`, `expense-refunds.tsx` in their feature directories).
- Icon-picker Browse: 36px (`features/categories/components/icon-picker.tsx`).
- Calendar days/arrows, month choices/arrows and Clear date: 40px
  (`shared/components/ui/calendar.tsx`, `shared/components/month-picker.tsx`,
  `shared/components/date-picker.tsx`).
- Default Select options: 40px minimum; overflow scroll arrows: 28px
  (`shared/components/ui/select.tsx`).
- Segmented radio targets: apparently 36px inside the padded 44px track
  (`shared/components/ui/segmented-control.tsx`).
- Authentication account-switch links and transaction-form wallet guidance
  links have text-sized targets. Report wallet-name links have a 44px minimum
  height but no minimum width.

Seven 44px calendar columns plus current 24px padding need 332px before
borders, exceeding the 328px content column at the supported 360px phone
viewport. Calendar spacing needs a deliberate adjustment.

Existing `apps/web/tests/e2e/shell.spec.ts` coverage checks exact 44px heights
for selected shell/filter controls, but misses widths and the controls above.

## Confirmed decisions

Accepted during grilling on 2026-09-24:

- Every phone control must have a tappable area at least 44 by 44 CSS pixels,
  including authentication, destructive actions, calendar days, picker
  options, and transaction-form controls. This explicitly extends the
  original redesign's scope to transaction-form target sizing.
- The minimum applies to the tappable area in both dimensions, not the
  visible artwork. Small icons and the 32px avatar may retain their visual
  sizes within larger targets. Adjacent targets must not overlap.
- Inline authentication account-switch links and transaction-form wallet
  guidance links become separate actions beneath their explanatory text,
  with targets at least 44px tall and 44px wide.
- On phone, segmented tracks grow to 52px, preserving the 4px inset around
  44px-tall segment targets.
- On phone, reduce the calendar's internal horizontal padding so seven
  44px columns fit within the existing page gutters at the supported 360px
  viewport. Targets must not overlap or introduce horizontal overflow.
- Apply the new sizing below the existing 640px breakpoint. Preserve current
  desktop sizing at 640px and above.
- The universal rule also covers Select overflow scroll arrows; their
  current 28px targets must meet the phone minimum when displayed.

These are target requirements; DESIGN.md continues to describe the shipped
build until implementation is verified. The user confirmed shared
understanding on 2026-09-24; grilling is complete. Application implementation
has not started.

## Implementation acceptance criteria

- Cover all inventory entries with the universal phone target rule, including
  minimum width for short labels. Preserve existing targets larger than 44px.
- Verify rendered target dimensions and usable, non-overlapping hit areas;
  measuring a padded parent alone is insufficient. Check open pickers, long
  Select menus, empty states and authentication as well as the signed-in shell.
- Keep calendar content within the supported 360px viewport and ensure all
  options in long menus remain reachable by scrolling.
- Extend focused browser coverage to check minimum width and height rather
  than exact height alone. Follow the current repository gate: `pnpm run ci`
  and one focused SPA spec on `phone-chromium`, with heavy tasks serialized.
- After implementation and verification, refresh DESIGN.md and
  `.impeccable/design.json` to describe the shipped behavior.
- This is a reversible UI sizing decision, with no new domain vocabulary or
  qualifying architectural trade-off; no CONTEXT.md or ADR addition is needed.

## Comments

Filed by ticket 08's shipped-build documentation review on 2026-09-24. This
is implementation drift and is out of scope for the documentation ticket.

2026-09-24: Grilling round 1 accepted the universal phone-control rule and
44 by 44 CSS-pixel tappable-area measurement. See Confirmed decisions above.

2026-09-24: Grilling round 2 accepted separate guidance actions, 52px phone
segmented tracks, reduced phone calendar padding, and the existing 640px
breakpoint with desktop sizing preserved.

2026-09-24: User confirmed the complete shared understanding and concluded
grilling. The confirmed decisions and implementation acceptance criteria
above are ready for implementation.

2026-09-24: Implemented in `5861aa6`. The button primitive's app-facing
sizes (`default`, `lg`, `icon`, `icon-lg`) are 44px targets below 640px and
keep their desktop heights from 640px; the separate `touch` size folded into
`lg`. `linkActionClass` in the button primitive carries the restructured
authentication account-switch and transaction-form wallet guidance actions
at a 44 by 44 target at every width. Inputs, select options and their
overflow arrows, calendar cells and arrows, month choices, the icon picker's
browse action, report wallet-name links and segmented tracks follow the
confirmed decisions; the calendar's phone padding narrowed to `px-2` so
seven 44px columns fit the 328px column. The shell spec asserts minimum
44 by 44 (52 for segmented tracks) across the inventory — authentication,
empty states, reports, refund and delete actions, open calendars, and long
select menus with their last option reached by scrolling. Verified: the
focused spec alone on `phone-chromium` and the full `pnpm run ci` gate.
