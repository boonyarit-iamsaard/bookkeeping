# 03: Create categories within transaction entry

**What to build:** Search and choose categories or create a missing parent/child while staying on transaction create/edit. Newly saved categories are immediately selected and use recommended or manually chosen icons.

**Blocked by:** 02: Record income and expenses reliably.

**Status:** done

## Acceptance criteria

- [x] Search both levels of the active income/expense tree and show parent › child results grouped under parents; either level is selectable.
- [x] An unmatched query offers category creation with that name prefilled, without navigating away from the transaction screen.
- [x] Create a parent or a child under an existing parent; create a missing parent within child creation. Restrict trees to two levels and require owner/tree-consistent relationships.
- [x] Reject blank names and scoped duplicates after surrounding-whitespace trimming and case-insensitive comparison. Parent scope is user/tree; child scope is parent. Enforce this under concurrent creation too.
- [x] Do not permit children beneath Uncategorized. Category creation cannot change its protected name or remove it.
- [x] Save categories independently, select the newly created category immediately, and preserve transaction form values. Canceling the transaction retains saved categories; no persistent transaction draft is required.
- [x] Ship a catalog with unique permanent IDs, Lucide glyph mappings, browsing groups, and English semantic tags. Persist the chosen ID only; catalog groups do not become financial categories. Confirm exact catalog contents during this ticket.
- [x] Recommend up to six icons locally using consistently normalized English names/tags, stronger whole-name/token matches before weaker matches, and deterministic ties. Check compound names such as car insurance and short-token false positives.
- [x] Require an icon with a guaranteed generic preselection; allow browsing by group and manual overrides. Empty/unmatched queries or recommendation failure never block saving. Unknown stored IDs render generically without silently rewriting the ID.
- [x] Use the confirmed panel/dialog behavior, appropriate phone/desktop transitions, labels, field errors, focus handling, and reduced motion. Nested keyboard actions cannot accidentally submit/cancel the outer transaction. Apply impeccable and visually verify the flow.
- [x] Cover ownership, scoped uniqueness, two-level protection, durable independent category saves, and selected icon persistence through PostgreSQL operations; browser-test missing-parent/child creation and canceled-transaction persistence.
- [x] Make the category interaction reusable by the later edit surface without adding a dependency on 04. Run relevant tests and existing repository checks.

## Scope and handoff

Rename/icon updates and category removal management follow in 08; do not add child reparenting. Covers spec criteria 1, 15–17, 19, 24–25 and the confirmed icon implementation notes.

## Comments

2026-09-13 — Implemented on `main`.

- Category row: the native select became a 44px trigger reading back
  "Parent › Child" with its pictogram; it opens one panel with two views
  (search, create). Phone: bottom sheet sliding up; desktop: centred dialog
  popping in; both collapse under reduced motion. Base UI Dialog, portaled,
  so the transaction form's Escape handler never sees the panel, and the
  create form stops its own submit events so Enter never reaches the outer
  form. Values in the transaction form are untouched throughout.
- Search (`category-search.ts`): both levels of the active tree, grouped
  under parents; a matching parent brings every child, a matching child
  brings its parent as a selectable heading; trimmed, case-folded,
  diacritic-insensitive. No exact match offers "Create “query”" (leading
  when nothing matched, trailing otherwise); an empty query ends with "New
  category". Arrow keys walk the results; Enter in the search box takes the
  first.
- Creation (`createCategory` operation + `createCategoryAction`): a parent,
  a child under an existing top-level parent, or a child together with a
  missing parent in one transaction (a taken parent name rolls both back).
  Rejections: blank/over-60-character names, unknown icon ids, parent not
  found (cross-user, cross-tree), parent not top-level (two levels only),
  parent protected (Uncategorized has no children). Scoped duplicates rely
  on the existing partial unique indexes, so concurrent saves lose cleanly;
  the violation is mapped to the right name field. The 60-character bound is
  defensive, not a product limit (the spec sets none).
- Icon catalog confirmed with the user (2026-09-13): ~100 stable ids in 12
  browsing groups (Money & income, Food & drink, Transport, Home &
  utilities, Shopping, Health & fitness, Leisure, Family & pets, Work &
  education, Travel, Fees & finance, General), each with English tags; the
  original 38 ids are unchanged. `GENERIC_ICON` is looked up by id, never by
  array position; unknown stored ids render it without being rewritten.
- Recommendations (`icon-suggestions.ts`): normalised, lightly stemmed
  tokens; a whole-name phrase (100) outranks whole tokens (30), prefixes
  (10, tokens ≥3 chars) and substrings (4, ≥4 chars); each token is weighted
  by how few icons carry it, so "electricity bill" lands on the plug and
  "dog food" on the dog; ties fall to catalog order; six at most. Confirmed
  with the user: the icon follows the top recommendation until picked by
  hand; generic stays when nothing matches, so saving never blocks.
- Reuse for 04/08: `CategoryPicker`, `CategoryCreateForm`, and `IconPicker`
  live under `src/features/categories/components/` with no dependency on
  the transaction form; `FieldErrors` moved to `src/shared/components/form/`.
- Pre-existing phone bug fixed on the way: the app header overflowed 412px
  (wordmark + nav + "Sign out"), which widened the mobile layout viewport to
  443px and pushed both the fixed Save bar and the new sheet off the right
  edge. The header now fits 360px (icon-only Sign out below 640px with its
  name kept for assistive technology). Root layout also declares
  `interactive-widget=resizes-content` so the on-screen keyboard shrinks
  the layout viewport instead of covering the Save bar and the sheet.
- Tests: 6 PostgreSQL operation tests (parent + child listing with icons,
  atomic missing-parent creation and rollback, trim/case-insensitive scoped
  duplicates with the protected parent untouched, two-level/protected/
  cross-user/cross-tree parents, unknown icon, 4-way concurrent duplicate);
  15 unit tests (ranking, search grouping, form schema); 2 browser tests ×
  phone/desktop (search either level, create missing parent + child, cancel
  keeps the categories, keyboard containment, duplicate/blank errors,
  reduced motion). Existing transaction browser tests updated for the new
  control.
- Design: extension of the incumbent world; surface brief updated at
  `.impeccable/surfaces/src-app-app-transactions-new-page-tsx.md`;
  DESIGN.md unchanged; detector clean; inspected at 360px, 412px, 1280px.
