---
version: 1
slug: "src-app-app-transactions-new-page-tsx"
primary_target: "src/app/(app)/transactions/new/page.tsx"
related_targets:
  - "src/app/(app)/transactions/page.tsx"
  - "src/app/(app)/transactions/[id]/page.tsx"
---

# Surface brief: transactions (create, list, detail)

Status: confirmed by the user on 2026-09-12 (form brief), extended at
build on 2026-09-13 for the basic list and detail, and again on 2026-09-13
for the inline category panel (ticket 03). Visitor mode: Operate.
Platform: web (phone-first, desktop supported). Build path: code-led.

Product truth lives in `PRODUCT.md`, `.scratch/tracking/spec.md`,
`.scratch/tracking/design-brief-transaction-form.md`, and `CONTEXT.md`; this
brief does not restate it.

## Job and audience

The author, phone in one hand, seconds after paying: type the amount, tap
Save. Later, on any device: confirm what was recorded and when.

## Outcome and proof

- Primary action: Save on `/transactions/new`; fast path is amount → Save.
- Proof in the form: `฿` and satang always shown; the Save button reads the
  line back ("Save −฿120.00 · Cash") before commit.
- Success returns to `/transactions?saved=<id>` with the saved row
  highlighted by a short fade; detail shows every field plus "Recorded
  13 Sep 2026, 14:32" in Bangkok time, separate from the transaction date.

## Scope and boundaries

- Routes: `/transactions` (basic list, newest date first), `/transactions/new`,
  `/transactions/[id]` (detail). Header gains a Transactions link.
- Untouched: wallets pages, auth, category management.
- Anti-goals: no Transfer or Refund controls (tickets 05, 07); no edit/delete
  (04); no category rename/removal (08); no custom keypad; no celebratory
  motion; no type carried by colour alone.

## States and ranges

- No wallet: `/transactions/new` shows "Create a wallet first" with the
  create action instead of a disabled form.
- Amount 0.01–99,999,999.99; wallets 1–10; categories 8–15 parents with
  0–10 children (searchable panel, grouped by parent); note 0–200.
- Category panel: an empty query lists the whole tree; a query filters both
  levels; no exact match offers "Create “query”" (first when nothing else
  matches, last otherwise); an empty query ends with "New category".
  Creation errors sit under their field (blank, over 60 characters, taken
  within the tree or parent, missing parent); a network failure shows the
  error bar inside the panel. The transaction form behind keeps every value
  and is never submitted or cancelled by keys inside the panel.
- Validation inline under the field, values kept: empty/invalid/zero/
  over-limit/extra-decimal amount; future date; date before the wallet's
  opening (named); note over 200.
- Uncertain save (network error): fields locked, a notice explains that the
  previous save is being checked, Save becomes "Check and retry"; the same
  key and snapshot are replayed. Definitive rejection unlocks the form.
- In flight: Save disabled, "Saving…".

## Interaction and layout

- Phone: header with Cancel and "New transaction"; amount block first
  (`inputmode="decimal"`, autofocus, ฿ prefix, mono at 1.875rem in a 64px
  control: a deliberate step above DESIGN.md's `input-money`, because the
  confirmed form brief pins the amount as the focal moment); segmented
  Income / Expense; rows Wallet, Category, Date (with Today / Yesterday
  chips), Note; Save fixed at the bottom safe area, ≥48px, full width.
- Desktop: same order in a ~448px column; Save inline; Enter submits from
  the amount field; Esc cancels to `/transactions`.
- Category row: a 44px capsule button styled like the wallet select, with a
  32px Mist disc holding the category pictogram, "Parent › Child" text, and
  a chevron. Opens the panel.
- Category panel (phone): a sheet anchored to the bottom, 14px top corners,
  up to `100dvh − 48px` tall; it slides up over 300ms with an exponential
  ease-out behind a 30% Ink scrim. Header row (56px): title
  "Expense category" / "Income category", 44px close. Search capsule (44px,
  magnifier, "Search or create…"). Results: hairline-topped scrolling list;
  parent rows 48px with a 40px Mist disc and Body 500 name; child rows
  indented with a 32px disc, a Graphite "›", and Caption-weight name; the
  selected row tints its disc and shows a cobalt check. Create rows use a
  56px row with a cobalt-ringed "+" disc.
- Category panel (desktop): the same content in a centred 448px × 576px
  dialog with a 14px corner and a hairline ring, fading and scaling in
  (0.98 → 1) over 200ms. Both transitions collapse under
  `prefers-reduced-motion`.
- Create view (same panel): header with a back arrow and "New expense
  category"; fields Name (prefilled from the query, focused), Parent (native
  select: none / existing parents / "New parent…"), a hairline-boxed "New
  parent" group with Parent name and Parent icon when chosen, then Icon.
  Footer: "Save category" (primary, 44px, full width on phone, inline on
  desktop) and "Back".
- Icon picker: 44px Mist discs as native radios; up to six recommendations
  for the typed name with the top one preselected (generic when nothing
  matches) and the current choice always shown; a "Browse all icons"
  disclosure reveals the twelve catalog groups. The checked disc takes the
  cobalt selection ring and glyph (same treatment as the date chips).
- List: one 64px row per transaction: category pictogram in a 40px disc,
  category (parent › child) over wallet · date, signed figure right-aligned
  (− expense, + income). Empty state offers Record.

## Direction contract

THESIS: The amount leads; everything else is a defaulted row you touch only
when it is wrong. It refuses the multi-step wizard and the calculator sheet.

OWN-WORLD: The incumbent Bookkeeping world unchanged: near-white paper,
ink type, one cobalt for Save, focus, and the selected segment; red for
validation only. Inter for words, JetBrains Mono tabular for the amount
input and every figure. Pill controls, hairline rows, Lucide pictograms at
1.75 stroke inside a 40px mist disc.

STORY: Open, the keyboard is already up, type 120, read "Save −฿120.00 ·
Cash", tap. The row appears at the top of the list; the detail proves when
it was recorded.

FIRST VIEWPORT (phone): Cancel · New transaction. Amount block with ฿ at
row-figure size. Segmented Income / Expense. Wallet row, Category row, Date
row with chips, Note row. Fixed Save bar.

FORM: Extension of the confirmed form brief; the world is pinned; no roll.

FINISH: reviewed in one batched phone/desktop inspection; DESIGN.md
unchanged (ordinary extension); surface brief recorded here. The category
panel (2026-09-13) was inspected at 360px, 412px, and 1280px in one batched
round; it adds no shadow (a scrim plus a hairline ring) and no second accent.
