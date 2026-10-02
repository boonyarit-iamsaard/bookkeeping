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

**Status:** done

**Out of scope:** the category picker sheet, create-from-picker, and the
category editor (06); the transaction detail page and its delete
confirmation (03).

- [x] The new transaction screen, the edit screen, and the refund screen render the form on the new system, at 360px and from 640px.
- [x] The money input uses 01's money treatment and still works with the on-screen numeric keyboard.
- [x] Transfer From and To, and the refund's linked expense with its refund allowance, read clearly on the new system.
- [x] Validation errors, rule rejections, and an archived retained wallet render in the new system without clearing entered values; red is never the only signal.
- [x] The Save bar clears the home indicator and keeps the tab bar hidden, as today.
- [x] `DESIGN.md` changes only through a stated system change, recorded in this ticket's closing comment.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** `pnpm run ci`, then the transaction entry spec alone on one project (`phone-chromium`). Follow the local resource limits in `CLAUDE.md`.

## Closing note

### 2026-10-02: done

Built in `1e0f604`. The form now groups its fields on two cards over the
ground (amount and type, then wallet, category or destination, date, note)
with the fixed Save bar on Chrome. The shared primitives from 01 carried the
fields, the segmented control and the pickers unchanged.

Stated system changes, all recorded in `DESIGN.md`:

- **Form Cards**: the grouped-card layout for entry forms, the Amount field as
  the form's figure (it never takes the Midnight hero), the Iris Tonal
  selected date chip with a check, the form-level rejection card, and the
  Save bar spec.
- **Field errors carry a pictogram**: `FieldError` in the shared field
  primitive now leads with a circle-alert icon so red is never the only
  signal. This reaches every form (sign-in, sign-up, wallet, category), a
  side effect through a shared primitive, not a restyle of those screens.
- **Linked Expense**: the refund's source expense as a Wash-filled link with
  a neutral category tile and "left to refund" in Iris Tonal Ink.
- The Scope paragraph now names 02 as done.

The "No active wallets" states on the new and refund screens moved onto the
shared `EmptyState`; their copy is unchanged.

Left for later: the linked expense's tile is neutral because
`LinkedExpenseView` carries no category id, and adding one would rewrite
existing unit assertions; the hue can follow when 03 touches that view. The
transfer From and To keep their labels and the swap button with no extra
direction graphic, since the words carry the direction.

Verified: `pnpm run ci` passes and `transaction-entry.spec.ts` passes on
`phone-chromium` (6 passed, 1 desktop-only test skipped). Inspected in one
batched round at 360px and 1280px in light and dark on a throwaway local
database with placeholder data: new, edit, refund with an archived original
wallet, and a validation error. `/code-review` found no standards breaches
and no spec gaps; the stale "white card" comment it flagged is fixed.
