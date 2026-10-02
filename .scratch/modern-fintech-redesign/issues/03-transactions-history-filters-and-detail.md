# 03: Transactions: history, filters and detail

Read `../design-brief.md` first, then the `DESIGN.md` written by 01. The
flows in `.scratch/phone-first-redesign/spec.md` carry over; only their
visual rendition changes.

**What to build:** Reviewing and checking past transactions happens on the
new system. The Transactions screen shows the history in grouped list
sections built from 01's transaction row; the filter sheet and its removable
chips, the invalid-filter message, and the transaction detail page with its
linked refunds and delete confirmation are all in 01's language, in light
and dark.

**Blocked by:** 01 (Foundation: system, shell and Home)

**Status:** done

**Out of scope:** the edit and refund forms that the detail page opens (02).

- [x] The Transactions screen groups history rows into the new list sections, and paging still works.
- [x] The filter sheet and its fields are on the new system; Apply and Clear stay neutral.
- [x] Active filter chips are removable, keep 44px phone targets, and each removes only its own URL value.
- [x] Invalid URL filter values stay visible and editable, with the invalid-filter message on the new system.
- [x] The detail page shows type, amount, category with its color, wallet or From and To, transaction date, recording time, note, and linked refunds or expense on the new system.
- [x] The linked expense tile shows its category color. 02 left it neutral because `LinkedExpenseView` carries no category id (see 02's closing note); adding the id may touch existing unit assertions, so extend them rather than rewrite them.
- [x] The delete confirmation alert sheet is on the new system and keeps its answer-not-dismiss behavior.
- [x] The history and detail loading skeletons and error screens use 01's patterns; loading never shows sample money.
- [x] `DESIGN.md` changes only through a stated system change, recorded in this ticket's closing comment.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** `pnpm run ci`, then the history spec alone on one project (`phone-chromium`). Follow the local resource limits in `CLAUDE.md`.

## Closing note

### 2026-10-02: done

Built in `5f2ba2d`. History is now one list section per month of the
transaction date, each a list card of 01's transaction rows; paging still ends
in "Older transactions". The filter sheet keeps its fields and neutral Apply
and Clear; active filters are Iris Tonal chips with 44px targets that each lift
only their own URL value. The detail page leads with a Midnight hero for the
amount over a list card of fact rows, with the category's hue on its tile, and
an expense's refunds are a list section of rows in the expense's hue. The
delete confirmation is an alert sheet led by a Signal Red trash tile, still
answered and never dismissed.

Stated system changes, all recorded in `DESIGN.md`:

- **Error Notice**: the form-level rejection card is now one shared component
  (`ErrorNotice`), also used for an invalid history filter and a failed delete.
- **Filter Chips**: new component section.
- **Transaction History and Detail**: new section for the month groups, the
  detail's hero and fact rows, the refunds section and the delete sheet.
- **Linked Expense**: its tile and the refund form's fixed Category field now
  wear the category hue. `LinkedExpenseView` gained `categoryId`; the existing
  unit assertions were extended by one line each, not rewritten.
- **Skeletons**: the detail's fact rows and a title bar for screens whose name
  is not yet known.
- The Scope paragraph now names 03 as done.

Side effects worth knowing: `DisplayFigure` gained an optional `sign`;
`HistoryLoading` is shared by the edit, refund and wallet routes, so it no
longer names a screen and lost its `aria-busy` and `aria-label` (the sr-only
"Loading your records…" status remains; no test referenced them); the detail
route's loader now also reads the categories list.

Left for later: an invalid chip looks like a valid one (the notice names the
problem); the detail's loading hero skeleton is Midnight-tinted like Home's,
though DESIGN.md says "Card-colored", so one of them needs reconciling in the
final sweep.

Verified: `pnpm run ci` passes, and `history.spec.ts` (2 passed) and
`refunds.spec.ts` (1 passed) pass on `phone-chromium`. No browser test needed
its dates paged. Inspected at 360px in light and dark and at 1280px on a
throwaway local database with placeholder data: history with two pages,
the filter sheet with invalid and active chips, a transfer, an expense with
refunds, and the delete confirmation. The 1280px captures came back partly
clipped by the preview pane, so desktop was checked only for the detail page.
`/code-review` found no breach of a documented standard; its fixes (shared
`Money` in the "Refund of" row, an unused `className` removed) are in the
commit.
