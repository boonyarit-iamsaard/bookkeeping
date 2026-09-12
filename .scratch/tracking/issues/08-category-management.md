# 08: Manage categories and removal fallbacks

**What to build:** Manage income/expense categories outside entry, rename them or change their icons, and remove them safely while existing expenses and linked refunds retain valid categorization.

**Blocked by:** 03: Create categories within transaction entry; 07: Record and correct linked refunds.

**Status:** ready-for-agent

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
