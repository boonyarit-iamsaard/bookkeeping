# 22: Phone controls below the 44px target

Read `../spec.md` first (Rule amendments, Further Notes).

**What to decide:** The shipped redesign gives the high-reach phone controls
44px targets, but some other phone controls remain 36px or 40px. Decide whether
the 44px direction applies to every phone control and, if so, bring the
remaining controls into line.

**Blocked by:** None

**Status:** needs-triage

**Evidence:** Ticket 08's documenter found the empty-wallet and
empty-transaction primary actions still use `buttonVariants({ size: "lg" })`
(40px), while the button primitive's default and icon sizes remain 36px.
`DESIGN.md` records the shipped range rather than claiming these are already
44px.

- [ ] Inventory phone uses of the 36px and 40px button sizes.
- [ ] Decide whether every phone control or only high-reach controls must be
      at least 44px.
- [ ] If the universal rule stands, update the controls and focused browser
      coverage, then refresh `DESIGN.md` and `.impeccable/design.json`.

## Comments

Filed by ticket 08's shipped-build documentation review on 2026-09-24. This
is implementation drift and is out of scope for the documentation ticket.
