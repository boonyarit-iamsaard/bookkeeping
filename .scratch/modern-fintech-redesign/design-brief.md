# Modern fintech redesign: design brief

Status: ready-for-agent

Confirmed on 2026-10-01 through `/impeccable shape`. Inputs: `PRODUCT.md`
(Brand Commitments records the standing direction), `CONTEXT.md`, and the
incumbent `DESIGN.md`, which this redesign replaces and treats as evidence of
what is being left behind. The flows in
`.scratch/phone-first-redesign/spec.md` and
`.scratch/tracking/design-brief-transaction-form.md` carry over; only their
visual rendition is replaced.

## Job and audience

The owner, on an Android phone in Chrome as a PWA, usually seconds after
paying; desktop is the secondary review surface. Visitor mode is Operate:
scanning, capture, and checking outrank expression. The visual world is
replaced wholesale. Information architecture, the capture flow, sheets,
domain vocabulary, and every behavior carry over.

## Outcome

The app sits credibly beside MAKE by KBank and K PLUS: bright, card-based,
and finished to their craft level. Done means every screen is on the new
system and a new `DESIGN.md` documents it. Sit beside, not imitate: no KBank
green, bank marks, or borrowed layouts.

## Selected direction

Clean modern fintech, played straight at full craft, with four confirmed
moves away from the 2026-09 "statement" rendition:

- **Cards and surfaces:** a soft tinted ground with rounded cards; a hero
  balance card, wallet cards, and grouped list sections replace flat
  hairline rows.
- **Sans-serif money:** bold proportional figures with tabular digits
  replace JetBrains Mono. Exactness rules stay: `฿12,000.00`, a true minus
  sign, never rounded.
- **Light and dark:** both themes designed, following the system setting.
- **Category color and charts:** colored category pictograms; charts on
  Home and Reports.

The direction concept round was skipped because the owner pinned the
direction and benchmark; a pinned direction overrides the roll.

## Scope

Every screen: the shell (phone tab bar and title bar, desktop header), Home,
the capture form, Transactions with its filter sheet and chips, the wallet
list and wallet page, Reports, Categories and the category editor, sheets
and dialogs, sign-in and sign-up, and every empty, loading, and error state.

Charts use current API data only:

- Level 1: this month's Income against Net expenses; each wallet's share of
  the total as horizontal bars from a zero line, so negative balances extend
  left and stay visible (a pie or ring cannot show them).
- Level 2: a six-month Income and Net expenses trend built from six
  `/v1/reports/monthly` calls.

No backend or schema change is part of this redesign.

## Not in scope: level 3 data

Spending by category and balance over time need new server-calculated reads,
because category totals must follow the refund and parent/child category
rules. The owner will run that feature separately through the to-spec and
to-ticket workflow. This redesign defines its visual components (the
category breakdown bar and the trend chart style) so that feature can adopt
them, but never builds or fakes them with client-side sums.

## States and ranges

- Amounts from `฿0.00` to seven figures, and negative balances.
- One to about ten wallets, including archived ones.
- Long category and wallet names.
- Empty Home: no wallets, or wallets without transactions.
- Loading uses skeletons, never sample money.
- Validation errors, rule rejections, and the delete confirmation.

## Interaction and layout

- Phone first at 360px; every phone control keeps a 44 by 44 CSS pixel
  target. Desktop layout from 640px.
- Transaction type, sign, and direction never rely on red or green alone.
- Motion explains state changes and is removed under reduced motion.

## Constraints and decisions

- Chromium only (`docs/adr/0007`), English UI, THB only.
- **Category color:** each parent category gets a stable color from a fixed
  palette of about eight, derived client-side from its id; child categories
  inherit their parent's color. No schema change and no user choice. A
  user-chosen color would be a schema change for the to-spec workflow.
