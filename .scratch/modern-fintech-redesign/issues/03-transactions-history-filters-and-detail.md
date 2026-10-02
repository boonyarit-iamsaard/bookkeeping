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

**Status:** ready-for-agent

**Out of scope:** the edit and refund forms that the detail page opens (02).

- [ ] The Transactions screen groups history rows into the new list sections, and paging still works.
- [ ] The filter sheet and its fields are on the new system; Apply and Clear stay neutral.
- [ ] Active filter chips are removable, keep 44px phone targets, and each removes only its own URL value.
- [ ] Invalid URL filter values stay visible and editable, with the invalid-filter message on the new system.
- [ ] The detail page shows type, amount, category with its color, wallet or From and To, transaction date, recording time, note, and linked refunds or expense on the new system.
- [ ] The linked expense tile shows its category color. 02 left it neutral because `LinkedExpenseView` carries no category id (see 02's closing note); adding the id may touch existing unit assertions, so extend them rather than rewrite them.
- [ ] The delete confirmation alert sheet is on the new system and keeps its answer-not-dismiss behavior.
- [ ] The history and detail loading skeletons and error screens use 01's patterns; loading never shows sample money.
- [ ] `DESIGN.md` changes only through a stated system change, recorded in this ticket's closing comment.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** `pnpm run ci`, then the history spec alone on one project (`phone-chromium`). Follow the local resource limits in `CLAUDE.md`.
