# 06: Categories: management, editor and picker

Read `../design-brief.md` first (Constraints and decisions: category color),
then the `DESIGN.md` written by 01.

**What to build:** Choosing and managing categories happens on the new
system, with category color. The category picker sheet that capture opens,
creating a category without leaving the form, the Categories screen with its
income and expense trees, the category editor, the icon picker, and the
inline remove confirmation are all in 01's language, in light and dark.

**Blocked by:** 01 (Foundation: system, shell and Home)

**Status:** ready-for-agent

**Out of scope:** the rest of the transaction form (02). Any user-chosen
category color, which would be a schema change.

- [ ] The category picker sheet shows parent and child categories with their pictograms in the parent's derived color, and search still works.
- [ ] Create-from-picker and editing from the picker are on the new system and return to the form as today.
- [ ] The Categories screen shows both trees in grouped sections, with Uncategorized marked as protected in words, not color alone.
- [ ] The category editor and the icon picker, with its keyword recommendations, are on the new system; the icon picker keeps 44px phone targets.
- [ ] The inline remove confirmation and its blocked cases (protected, has children, in use) are on the new system.
- [ ] Long category names hold their layout at 360px.
- [ ] `DESIGN.md` changes only through a stated system change, recorded in this ticket's closing comment.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** `pnpm run ci`, then the category management spec alone on one project (`phone-chromium`). Follow the local resource limits in `CLAUDE.md`.
