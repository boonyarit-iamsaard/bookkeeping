# 02: Capture form: new, edit and refund

Read `../design-brief.md` first, then the `DESIGN.md` written by 01. The
capture flow in `.scratch/tracking/design-brief-transaction-form.md` carries
over; only its visual rendition changes.

**What to build:** Recording a transaction seconds after paying, correcting
one, and recording a refund all happen on the new system. The one
transaction form that the new, edit and refund screens render shows the type
segment, the money input, wallet and date fields, the note, the linked
expense on a refund, and the fixed Save bar in 01's language, in light and
dark.

**Blocked by:** 01 (Foundation: system, shell and Home)

**Status:** ready-for-agent

**Out of scope:** the category picker sheet, create-from-picker, and the
category editor (06); the transaction detail page and its delete
confirmation (03).

- [ ] The new transaction screen, the edit screen, and the refund screen render the form on the new system, at 360px and from 640px.
- [ ] The money input uses 01's money treatment and still works with the on-screen numeric keyboard.
- [ ] Transfer From and To, and the refund's linked expense with its refund allowance, read clearly on the new system.
- [ ] Validation errors, rule rejections, and an archived retained wallet render in the new system without clearing entered values; red is never the only signal.
- [ ] The Save bar clears the home indicator and keeps the tab bar hidden, as today.
- [ ] `DESIGN.md` changes only through a stated system change, recorded in this ticket's closing comment.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** `pnpm run ci`, then the transaction entry spec alone on one project (`phone-chromium`). Follow the local resource limits in `CLAUDE.md`.
