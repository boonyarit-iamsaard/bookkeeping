---
version: 1
slug: "src-app-app-wallets-page-tsx"
primary_target: "src/app/(app)/wallets/page.tsx"
related_targets: []
---

# Surface brief: wallets (list and create)

Status: confirmed by the user on 2026-09-13. Visitor mode: Operate.
Platform: web (phone and desktop). Build path: code-led.

Product truth lives in `PRODUCT.md`, `.scratch/tracking/spec.md`, and
`CONTEXT.md`; this brief does not restate it.

## Job and audience

The author, first run (nothing tracked yet) or any later day (where does the
money sit). Success: a wallet created with an exact opening balance and date
in under a minute; `/wallets` reads as a trustworthy statement of holdings.

## Outcome and proof

- Primary action: Create wallet, on the full-screen route `/wallets/new`.
- Proof of exactness in the UI: every figure `฿12,000.00` in tabular numerals,
  currency shown as a fixed `THB`, each wallet shows "Opened 1 Sep 2026" so an
  opening reads as a balance rather than income.
- Empty state on `/wallets`: "No wallets yet" plus the create action; no
  placeholder or fabricated figures. In the empty state the header Create
  button is omitted so the page carries exactly one call to action (decided
  at build, 2026-09-13).

## Scope and boundaries

- Routes: `/wallets`, `/wallets/new`, plus a minimal app header (wordmark,
  Wallets link, sign-out) that later tickets extend.
- Untouched: auth screens and behaviour.
- Anti-goals: no archive/edit/delete controls (ticket 06), no charts, no
  celebratory motion, no type carried by colour alone.

## States and ranges

- Wallets 1–10 (typical 3–4); names to ~40 characters; balances from
  negative to beyond 32-bit satang.
- Create form validation, inline under the field with values preserved:
  blank name, name over 40 characters, blank or malformed amount, more than
  two decimals, missing date. Server error bar at the top of the form.
- Submit: Save disabled and labelled "Saving…" in flight; success returns to
  `/wallets` with the new row present.

## Interaction and layout

- `/wallets` phone: header, page title "Wallets", total balance at display
  size with its count line beneath, then one 56–64px row per wallet:
  type pictogram · name over type label · balance right-aligned. Create is a
  header button and the empty state's action.
- `/wallets` desktop: same order in a centred column of about 640px.
- `/wallets/new`: Name → Type (segmented Cash / Bank account / E-wallet) →
  Opening balance (`฿` prefix, `inputmode="decimal"`, fixed THB, negatives
  allowed) → Opening date (defaults to today in Bangkok). Save fixed at the
  bottom safe area on phone (≥48px); inline in a ~480px column on desktop.
  Enter submits; Esc cancels back to `/wallets`.
- Motion: one moment only — the segmented indicator slides and the saved row
  (identified by `?created=<id>`) arrives with a short fade; all under
  `prefers-reduced-motion`.
- The opening-date field echoes the chosen date in the product's own form
  ("start of 13 Sep 2026") beneath the native date control.

## Direction contract

THESIS: A statement of holdings, not a dashboard. One total, one row per
wallet, exact to the satang; it refuses the card grid of icon tiles and the
stat-strip hero.

OWN-WORLD: Light near-white ground, near-black type, one cobalt accent
`oklch(0.52 0.20 262)` for the primary button, focus ring, and segmented
selection; red only for validation and destructive. Inter for text, JetBrains
Mono with tabular numerals for every money figure; display figures step the
currency symbol and satang down to 0.6em so whole baht leads. Hairline
dividers, the incumbent shadcn pill radius on controls, no card shells inside
the list, Lucide pictograms at one stroke weight for wallet types. The
segmented control's selected label takes the accent; its indicator is white.

STORY: The visitor sees the total, then which wallet holds what, believes the
numbers are exact because currency and satang are always present, and either
creates the next wallet or leaves reassured.

FIRST VIEWPORT: Slim header (wordmark left, Wallets link, sign-out right).
Below it, in a ~640px column: "Wallets" as the h1 with the Create wallet
button on the same line; the total in mono at ~2.5rem with "across 3 wallets"
beneath; then the wallet rows separated by hairlines. Phone: the same, one
column, Create button full width under the title.

FORM: The clean-modern-fintech canon, user-pinned as a brand commitment in
PRODUCT.md; composition chosen by the user (total headline + flat list;
full-screen create route). No concept roll was run; seed key: none (pinned).

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
