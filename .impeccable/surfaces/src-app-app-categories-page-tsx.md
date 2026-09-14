---
version: 1
slug: "src-app-app-categories-page-tsx"
primary_target: "src/app/(app)/categories/page.tsx"
related_targets: ["src/features/categories/components/category-management.tsx"]
---

# Surface brief: categories (management)

Status: structure confirmed by the user on 2026-09-14 (list + edit sheet).
Visitor mode: Operate. Platform: web (phone and desktop). Build path: code-led.

Product truth lives in `PRODUCT.md`, `.scratch/tracking/spec.md`, and
`CONTEXT.md`; this brief does not restate it.

## Job and audience

The author, occasionally, after a few weeks of entries: rename a category
that no longer fits, give it a better pictogram, or remove one and let its
entries fall back. Success: the whole tree is readable at a glance, a rename
takes seconds, and removal states exactly where entries go before it happens.

## Outcome and proof

- Every category of both trees is findable within seconds; parents lead,
  children sit indented beneath them, each row shows its current pictogram
  and how many current entries use it.
- Removal copy names the count and the destination ("9 entries move to
  Food & Drink") before the destructive button appears; a parent with
  children shows why it cannot go yet instead of a disabled button.
- Uncategorized is listed with the others; its sheet explains it keeps its
  name and place, and offers the icon change only.

## Scope and boundaries

- Route: `/categories`, plus a Categories link in the app header.
- Reuses: the category picker's row vocabulary, `CreateCategoryForm` and
  `IconPicker` inside the sheet, the wallets list and management copy tone.
- Untouched: the transaction form's picker; the create form's behavior.
- Anti-goals: no reparenting UI, no drag and drop, no archive, no card grid.

## States and ranges

- Trees of 8–20 parents with 0–6 children each; names to 60 characters.
- Usage counts 0–thousands; zero renders as "No entries".
- Sheet validation inline with values kept: blank, too long, duplicate,
  unknown icon, protected rename. Server error bar for removal rejections
  (children remain, entry landed meanwhile, category gone).
- In flight: Save reads "Saving…", Remove reads "Removing…"; both disabled.
- After a change: the sheet closes, the list re-renders from the server, a
  status line under the title announces what happened.

## Interaction and layout

- Phone: header, "Categories" h1 with New category beneath it, the
  Expense/Income segmented control, then full-bleed hairline rows (parent
  56px: 40px disc, name Body 500, count Caption right; child 48px: 32px disc,
  indented with ›). Row is a button opening the sheet.
- Desktop: same order in the 672px column; New category on the h1 line; the
  sheet becomes a centred dialog.
- Sheet: title "Edit category", parent path as Caption beneath, Name, Icon
  (recommendations + browse), Save; a hairline; Remove section with the
  explanation, then "Remove…" expanding to confirm/cancel.
- Keyboard: rows are buttons in DOM order; Esc closes the sheet; Enter in
  Name saves; focus returns to the row's position after close.

## Direction contract

THESIS: The tree as a statement, not a settings grid. One list, two trees
behind a segmented switch, every row telling you what it is and how much it
holds; it refuses the icon-tile grid and the modal-per-field pattern.

OWN-WORLD: The incumbent Bookkeeping world unchanged: near-white ground, Ink
type, one cobalt on the primary action, focus and selection; hairline rows;
Lucide pictograms at stroke 1.75 in Mist discs (40px parent, 32px child);
counts in Inter Caption, never mono (they are not money).

STORY: The visitor scans the tree, spots the row to change, opens it, sees
the current pictogram and exactly what a removal would do, and acts or
leaves without doubt about where entries went.

FIRST VIEWPORT: Header; "Categories" h1 with New category (cobalt) on the
same line from 640px; the Expense | Income segmented control full width;
the first six to eight rows of the expense tree, Food & Drink leading with
its children indented beneath.

FORM: Established world; local extension of the wallets list and
management composition. No concept roll was run; seed key: none (extension).

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
