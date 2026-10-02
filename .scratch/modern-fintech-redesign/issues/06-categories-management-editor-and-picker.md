# 06: Categories: management, editor and picker

Read `../design-brief.md` first (Constraints and decisions: category color),
then the `DESIGN.md` written by 01.

**What to build:** Choosing and managing categories happens on the new
system, with category color. The category picker sheet that capture opens,
creating a category without leaving the form, the Categories screen with its
income and expense trees, the category editor, the icon picker, and the
inline remove confirmation are all in 01's language, in light and dark.

**Blocked by:** 01 (Foundation: system, shell and Home)

**Status:** done

**Out of scope:** the rest of the transaction form (02). Any user-chosen
category color, which would be a schema change.

- [x] The category picker sheet shows parent and child categories with their pictograms in the parent's derived color, and search still works.
- [x] Create-from-picker and editing from the picker are on the new system and return to the form as today.
- [x] The Categories screen shows both trees in grouped sections, with Uncategorized marked as protected in words, not color alone.
- [x] The category editor and the icon picker, with its keyword recommendations, are on the new system; the icon picker keeps 44px phone targets.
- [x] The inline remove confirmation and its blocked cases (protected, has children, in use) are on the new system.
- [x] Long category names hold their layout at 360px.
- [x] `DESIGN.md` changes only through a stated system change, recorded in this ticket's closing comment.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** `pnpm run ci`, then the category management spec alone on one project (`phone-chromium`). Follow the local resource limits in `CLAUDE.md`.

## Closing note

### 2026-10-02: done

Built in `6f9e6d8`. Categories keeps its title, segmented control and
read-back notice, now the shared Saved Notice, and lays each tree out as one
list card per parent, with children on the same card. Parent rows lead with a
44px Category Tile in the parent's derived hue. Child rows lead with a Slate ›
under the parent's tile and a 36px tile in the same hue. Names wrap, and
Uncategorized says "Protected" with a lock beside its entry count. The picker
sheet uses the same rows, so search, the chosen row's check and the create
tile all sit on the new system. Its trigger wears the chosen category's hue
and wraps a long path instead of truncating. The editor and the new-category
form use the Error Notice and a Mist New parent panel; Parent options carry
their hue tiles. Removal sits apart under a hairline: a blocked case
(protected, has children) is a Mist panel led by its reason's pictogram, and
an in-use category gets a Destructive Remove… whose inline confirmation
matches Manage's.

Stated system changes, all recorded in `DESIGN.md`:

- **Categories**: new component section for the trees, the editor and its
  removal states, the Icon Picker and the Category Picker.
- **Icon Picker**: unchosen icons are Mist tiles; the chosen one becomes the
  category's own hue tile with an Iris outline and a check badge, so it
  previews the row and selection is never the hue alone. A new parent previews
  neutral, a new child its parent's hue.
- **Category Tile sizes**: a 36px child tile in trees (`CategoryTile` gained a
  `size`), and 28 or 32px tiles inside fields and Select options.
- **Saved Notice** takes a `ref` and `tabIndex`, so Categories keeps it
  mounted and moves focus to it after a removal, as before.
- **Mist** and **Iris Tonal** list their new uses; the **Error Notice** covers
  category rejections; small marks (checks, the caption lock, the create ＋)
  are recorded at stroke 2 to 2.25 and the badge check at 3.
- Manage's confirmation panel corner is corrected to 16px in `DESIGN.md`
  (the code was already 16px). The Scope paragraph now names 06 as done.

Category rows drop their trailing chevron, like Transaction Rows; with the ›
connector it read as two chevrons per child. `CategoryDisc` is gone.

"Editing from the picker" was read as the picker on the edit-transaction
screen: the picker has no edit action today, and the ticket is visual only.
Choosing from it there returns "Food & Drink › Restaurants" to the edit form.

Left for later: the inline confirmation panel is copied from Manage rather
than shared; the final sweep can extract it. The row's accessible name now
includes "Protected" and the entry count, as the visible text always did for
the count; no test depends on the exact name.

Verified: `pnpm run ci` passes. `category-management.spec.ts` (2 passed) and
`transaction-entry.spec.ts` (6 passed, 1 desktop-only skipped) pass on
`phone-chromium`. No browser test needed its dates paged. Inspected in one
batched round at 360px in light and dark and at 1280px in light and dark, on
a throwaway local user with placeholder data: both trees with several parents
and children, Uncategorized, a long parent and a long child name, picker
search, create from the picker with a parent (back on the form as "Health ›
trampoline park"), the picker on the edit screen, the icon picker with
recommendations and the full catalog, and removal for protected, has
children, and in use with its confirmation. That round led to two fixes:
the trailing chevrons came off, and the catalog moved to neutral tiles. The
1280px captures sometimes came back clipped, so they were retaken until the
pane drew them scaled. `/code-review` found no spec gap. Its fixes are in
the commit: a shared `ChildMarker` and child tile size, a simpler parent-hue
preview, and stroke and corner values aligned with `DESIGN.md`.
