# 08: Manage categories and removal fallbacks

**What to build:** Manage income/expense categories outside entry, rename them or change their icons, and remove them safely while existing expenses and linked refunds retain valid categorization.

**Blocked by:** 03: Create categories within transaction entry; 07: Record and correct linked refunds.

**Status:** done

## Acceptance criteria

- [ ] Provide management for both per-user trees, reusing parent/child creation, catalog browsing, and recommendations instead of establishing another category model.
- [ ] Rename and change icons with owner/tree-scoped name uniqueness after trim/case normalization; preserve icon on rename and update labels used for existing transactions.
- [ ] Prohibit moving children between parents or nesting further. Either level remains selectable on entry/edit.
- [ ] Remove a child atomically by reassigning all affected transactions to its parent. Linked refunds automatically follow the expense's current category.
- [ ] Reject parent removal while any children exist, including unused children. Once childless, removal atomically reassigns its transactions/refunds to that tree's Uncategorized.
- [ ] Protect both Uncategorized parents from rename/removal/children while allowing icon changes. Never leave category references orphaned or merge income/expense trees.
- [ ] Serialize removal against transaction assignment/category creation and expense/refund changes as needed; failed operations leave categories and financial references unchanged.
- [ ] Initialization remains safe after customization; no later repeat overwrites renamed categories, recreates removed defaults, or duplicates protected parents.
- [ ] Apply impeccable to hierarchy, destructive-action explanations, current icons, labels, validation, and phone/desktop keyboard usability. Category changes do not force users out of an active transaction entry flow.
- [ ] PostgreSQL tests cover ownership, protected rules, uniqueness, rename/icon persistence, both fallback paths, concurrent conflicting operations, and refund inheritance. Browser-test management and feedback for a parent with children.
- [ ] Run relevant tests and existing repository checks.

## Scope and handoff

This ticket implements the accepted removal rules, not category archiving or reparenting. Reports verify these current-category relationships in 09. Covers spec criteria 1, 6, 15–19, 23–25 for category lifecycle and refund consistency.

## Comments

2026-09-14 — Implemented on `main` (`e5aa04d`). No schema change.

- Operations (`server/category-management.ts`): `updateCategory` renames
  and/or re-icons in one update guarded by
  `is_protected = false or name = current`, so Uncategorized takes a new icon
  but never a new name; the partial unique indexes report duplicates.
  `removeCategory` moves every transaction row (retained deleted ones
  included) to the fallback, then deletes: parent for a child, the tree's
  Uncategorized for a childless parent; a parent with any child is refused.
  Refunds follow because they never store a category (07).
- Serialization: `validateCategory` (transactions) and the parent lookup in
  `createCategory` now take `FOR SHARE`, so an in-flight assignment or
  child creation holds the removal until it lands, and a removal already
  committed makes the category vanish as `category-not-found` /
  `parent-not-found` rather than a foreign-key fault. Removal locks
  transaction rows before the category row, the order edits use, so the two
  never deadlock; the restrict foreign keys (`23001`) are the final word and
  map to `has-children` / `in-use` with nothing changed.
- `transaction_changes` snapshots keep a removed category's id as internal
  history JSON, as wallet snapshots do; no live reference is orphaned.
- UI: `/categories` (nav link added) with Expense | Income segmented rows,
  usage counts, and a per-row edit sheet (rename, icon, removal with the
  count and destination stated before the destructive confirm). New
  category reuses `CreateCategoryForm`; the sheet shell is now
  `shared/components/ui/sheet.tsx`, shared with the picker. The wordmark is
  omitted below 640px so three nav links fit a 360px phone.
- Tests: `category-management.integration.test.ts` (rename/icon, protected,
  uniqueness, ownership, both fallbacks, re-initialization, concurrent
  removal vs child creation and vs assignment, usage counts) and
  `tests/e2e/category-management.spec.ts` on desktop and phone.
