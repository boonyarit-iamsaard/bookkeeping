# Category selection during capture: design notes

Status: implemented

Candidate 2 from [the architecture review](../architecture-review-2026-10-02.html).
Decisions recorded during `/grill-with-docs` on 2026-10-02. All three candidates
were confirmed before the user authorized `/implement all`.

## Accepted decisions

1. **Keep the scope focused on selection during capture.** The feature-local
   module owns the current category list and the create-to-select handoff.
   Preserve the picker's appearance, search, keyboard behavior, and Transaction
   form values. Category management and editing are not being redesigned.
2. **Use one live category list.** The picker, selected category path, and colors
   use the same cached category read. Replace capture's independent snapshot
   and manual append. After creation, use the existing `refreshAfterWrite`
   policy and select the saved category once the refreshed list contains it
   and its Parent category. Capture no longer reconstructs that list itself.
3. **Separate saved creation from read recovery.** If creation succeeds but
   the category list cannot refresh, show that the category was saved and the
   list could not refresh. Keep creation disabled and offer a refresh-only
   retry. Select only after the live list contains the saved category and,
   for a Child category, its Parent category. Never repeat the successful
   creation request to recover the list.
4. **Do not apply an abandoned creation's selection.** Back and dismissal
   remain available during saving. A completed write still persists and
   refreshes the cache, but leaving the creation flow revokes its ability to
   select a category or close a subsequently reopened picker. A later user
   choice must remain intact.
5. **Preserve selection identity across live changes.** Renames, paths, icons,
   and colors follow the live list. If the selected category disappears, keep
   its ID and show "Selected category is no longer available" rather than
   silently substituting Uncategorized. The user can choose a replacement;
   existing submission rejection remains authoritative. Explicit Transaction
   type changes keep their existing category fallback behavior.
6. **Expose one selection handoff.** Capture owns `categoryId`. The Category
   selection module owns the live list and creation lifecycle and emits one
   selection callback for both existing and newly created categories. Remove
   capture's separate `onCreated` outcome reconstruction and manual append.
   Any category list needed by capture's existing type-change or linked-refund
   behavior comes from the same cached read, not a second snapshot.
7. **Verify observable behavior.** Retain existing pure category tests. Cover
   Parent category plus Child category creation, preserved Transaction values,
   failed refresh after successful creation with read-only retry, dismissal
   during saving, live rename/removal, and focus return in one focused capture
   browser spec. Follow the repository's one-project browser policy and local
   resource limits. No new testing framework or catalog adapter is needed.

## Established constraints

- Keep the existing category read/write contracts and HTTP adapter. No schema,
  server business-rule, or category color-policy changes are needed.
- Keep cache declarations and path/parameter keys in `core/api/queries.ts`.
  `refreshAfterWrite` remains the global post-write refresh authority; do not
  insert created category records directly into the query cache.
- Preserve Parent category and Child category meanings, two-level category
  trees, protected Uncategorized, and inherited category hues.
- Capture retains ownership of the Transaction's category field and its field
  rejection. Choosing a category must not reset other Transaction values.
- Shared creation-form consumers may need a coordinated adaptation, but this
  is not authorization to redesign category management or broaden its behavior.
- Follow the repository's root `CONTEXT.md` layout. These decisions establish
  implementation ownership, not new domain vocabulary. No glossary addition
  or ADR is justified yet.
- Implementation of all three agreed candidates was authorized on 2026-10-02.

## Shared understanding

All seven interview decisions have been accepted, and the user confirmed shared
understanding on 2026-10-02. The user subsequently confirmed candidate 3 and
released the implementation hold for all three candidates with `/implement all`.

## Source facts before implementation

- `transaction-form.tsx` snapshots its initial categories once and manually
  appends the created category plus an optional created Parent category.
- The current category-color hook subscribes to the cached read. The picker
  instead derives names, search, icons, paths, and colors from its supplied
  category snapshot. Refreshing the cached read need not update that snapshot.
- The creation hook waits for global post-write refresh, recovers a created
  Parent category from cached data, then emits a creation outcome. Capture
  appends that outcome and selects the category before the picker closes.
- The installed query library suppresses individual refetch failures under
  the current `invalidateQueries` defaults. Awaiting `refreshAfterWrite` does
  not prove that the category list includes a newly saved category and parent.
  A failed background refresh can preserve an older cached list.
- The creation form's Back control remains available while submitting. The
  eventual creation callback has no explicit abandoned-view selection guard.
  This is a source-supported risk, not a reproduced failure.

## Source pointers

- `apps/web/src/features/transactions/components/transaction-form.tsx`
- `apps/web/src/features/categories/components/category-picker.tsx`
- `apps/web/src/features/categories/components/create-category-form.tsx`
- `apps/web/src/features/categories/hooks/use-create-category-form.ts`
- `apps/web/src/features/categories/hooks/use-category-colors.ts`
- `apps/web/src/features/categories/category-mutations.ts`
- `apps/web/src/core/query/refresh-after-write.ts`
- `apps/web/tests/e2e/transaction-entry.spec.ts`

## Implementation outcome

`use-category-catalog.ts` supplies the live catalog to capture and the picker.
Capture no longer snapshots or appends categories. The shared creation hook
tracks durable success, offers read-only recovery, and waits for a complete
catalog before handing off selection. The picker guards abandoned creation
flows and preserves a missing selected ID explicitly.

The focused capture cases, shared category-management scenario, and
`pnpm run ci` passed. Standards and Spec reviews have no remaining findings.
See the [implementation record](../architecture-implementation-2026-10-02.md)
for scope and verification results.
