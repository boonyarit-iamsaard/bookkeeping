# Design brief: transaction create/edit

Status: Confirmed by the user on 2026-09-12. Visitor mode: Operate.
Platform: web (phone-first, desktop supported). Build path: code-led.

Product truth lives in `PRODUCT.md`, `spec.md`, and `CONTEXT.md`; this brief
does not restate it.

## Job and audience

The author, phone in one hand, seconds after paying: record what just left
(or entered) a wallet before the moment passes. Secondary: the same person at
a desk later, correcting a transaction, adding a refund, or entering a batch.
Success is a saved, correct transaction within a few seconds of opening the
screen, with nothing to decide that the defaults did not already decide.

## Outcome and proof

- Primary action: Save. Fast path is amount → Save; type defaults to Expense,
  wallet to last used, date to today (Bangkok), category to Uncategorized.
- Edit changes any field except type; refunds arrive pre-linked from the
  expense's detail view, never from the type picker.
- Proof of correctness is in the form itself: ฿ and satang always shown,
  tabular numerals, the Save button reading the line back
  ("Save −฿120.00 · Cash") before commit.

## Selected direction

Clean modern fintech, the category standard, played straight. Craft bar:
K PLUS / SCB Easy / Krungthai NEXT (trust, confirm flows), Apple Wallet and
Cash (numeral scale, restraint, motion as feedback), Money Lover / Spendee /
Copilot (category pictograms, quick entry).

- **Structural thesis:** the amount leads; everything else is a defaulted row
  you touch only when it is wrong.
- **Colour strategy:** restrained. Light ground for daylight phone use, one
  accent for the primary action and selection; the accent is chosen at build
  and recorded in DESIGN.md at finish. Type is carried by word and sign
  (+ income, − expense, → transfer, ↩ refund); colour may reinforce, never
  carry alone. One colour reserved for validation and destructive actions.
- **Type:** the existing Inter and JetBrains Mono stack; every money figure
  uses tabular numerals; the amount input at display size.
- **Sequence (phone):** open → amount focused with the numeric keyboard up →
  segmented type → rows → Save fixed at the thumb.
- **Focal moment:** the amount block, large, with the currency and two
  decimals always present, the keyboard already open.
- **Signature interaction:** picking Transfer re-lays the form in one move:
  the Wallet row becomes From → To with a swap control, the Category row
  disappears; no layout jump, labels legible throughout.
- **Implementation consequence:** a full-screen route, not a sheet, so the
  inline category panel, refund linkage, and deep links all have room.

## Scope and boundaries

- Routes: `/transactions/new`, `/transactions/[id]/edit`, and the refund
  entry `/transactions/new?refundOf=ID` (or equivalent) opened from an
  expense's detail. Refund from the expense only.
- In scope: create and edit for income, expense, transfer, refund; inline
  parent/child category creation with icon picker and local recommendations;
  all validation states below; idempotent create; phone and desktop layouts;
  delete from edit (with refund guard).
- Untouched: auth screens, the transaction list, wallet and category
  management pages, domain rules in `spec.md`.
- Anti-goals: no gamification or celebratory motion; no custom calculator
  keypad in v1 (native `inputmode="decimal"` keyboard, confirmed); no attachments, splits, or
  recurring options; no green/red as the only signal of type.

## States and ranges

- Amount: 0.01 to 99,999,999.99; typical 20–5,000. Reject empty, zero,
  more than two decimals.
- Wallets: 1–10, typical 3–4. Archived wallets are not offered for new
  entries; an existing transaction on an archived wallet stays editable and
  shows the wallet with an "Archived" tag.
- Categories: 8–15 parents per tree, 0–10 children each, names to ~40 chars.
  Picker shows parent › child; either level selectable.
- Note: optional, 0–200 chars, single line that grows.
- First run with no wallets: the form cannot open; show an empty state
  pointing to "Create a wallet" instead of a disabled form.
- Loading: skeleton rows in the same grid; the amount block never shifts.
- Validation (inline, under the field, form values preserved): future date;
  date before the wallet's opening date (name the date); transfer to the same
  wallet; refund exceeding the remaining refundable amount (show remaining);
  refund dated before the expense; expense reduced below its refunded total;
  delete blocked while refunds exist (list them).
- Edit: type shown as a fixed label with "Type can't be changed; delete and
  recreate" on tap; footer shows "Recorded 12 Sep 2026, 14:32" in Bangkok
  time, separate from the transaction date.
- Submit: button disabled and labelled "Saving…" while in flight; one
  idempotency key per form instance, reused on retry; on success return to
  the list with the saved row highlighted; on server error an error bar at
  the top of the form, values kept.

## Interaction and layout

- **Phone (≥360px):** header with Cancel, a title ("New expense", "Edit
  transaction", "Refund"), and on edit an overflow with Delete. Amount block
  at top. Segmented control Income / Expense / Transfer beneath (hidden on
  edit and refund, shown as a label). Rows: Wallet (or From → To), Category
  (pictogram, parent › child), Date, Note. Save fixed at the bottom safe area,
  full width, ≥48px tall, label reading the line back.
- **Desktop:** the same order in a centred column of about 480px; Save
  inline after the rows; Enter submits from the amount field; Esc cancels.
- **Wallet row:** opens a list of wallets with name, type, and current
  balance; last used preselected.
- **Category row:** opens a panel with search over both levels, results
  grouped under parents; when nothing matches, "Create `query`" (the typed name) leads the
  results. Creation: name, parent (existing or new parent inline), icon
  picker with up to six recommendations, the generic icon preselected, and
  browse-by-group behind it. Saving selects the category and returns to the
  form; the category persists even if the transaction is cancelled.
- **Date row:** date-only picker defaulting to today, disallowing future
  dates; quick chips for Today and Yesterday.
- **Refund form:** type locked to Refund; a linked-expense chip (category,
  date, amount, remaining refundable) at the top; amount prefilled with the
  remaining refundable; wallet defaults to the expense's wallet; category
  displayed read-only as inherited.
- **Motion:** segmented indicator slides; the category panel slides up on
  phone and pops on desktop; Save has a press state; all under
  `prefers-reduced-motion`.

## Constraints and open decisions

- Stack: Next.js App Router, React, TypeScript, shadcn on Base UI, Tailwind
  v4, TanStack Form, Zod, Lucide (icon catalog renderer), Drizzle. English
  only. Bangkok time for dates and recording time.
- Accessibility: touch targets ≥44px, labels on every control, errors
  announced and associated with their field, keyboard-complete on desktop.
- Open, for the builder to settle with the user, not invent: the accent
  colour; whether the transaction list gets a quick-add button (outside this
  brief); the icon catalog contents (see `technical-design.md`); whether v2
  wants a custom amount keypad.
