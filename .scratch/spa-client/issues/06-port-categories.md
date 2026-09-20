# 06: Port categories

Read `../worker-brief.md` first.

**What to build:** The categories screen: both trees behind the Expense |
Income segmented control, the edit sheet (rename, icon picker with
recommendations and browse, remove with usage count and destination in
prose), the create form, the Uncategorized read-only case, and the status
line after a change. Legacy category specs are retired.

**Blocked by:** 05: Port wallets

**Status:** ready-for-agent

**Pattern to copy:**

- Legacy `features/categories` in full: management component, picker, icon
  picker, icons and suggestions modules with their unit tests, create and
  edit forms with schemas and hooks, labels, name and search helpers.
- Data: the categories list and usage reads become query options; after a
  mutation, invalidate both so the list re-reads from the server as the
  legacy app did.
- Route: `/categories`. The category picker component is ported here too,
  even though no route uses it until ticket 07, so ticket 07 only wires it.

**Out of scope:** the transaction form (07); reordering, drag and drop,
colours, or any capability the legacy screen lacks; changing removal rules.

- [ ] `/categories` renders both trees with parent and child rows, entry counts, and the segmented control as `DESIGN.md` describes.
- [ ] Editing a category (name, icon) and creating one behave as before, including validation with values preserved.
- [ ] Removing a category shows the count and destination, confirms, closes the sheet, re-reads the list, and moves focus to the status line.
- [ ] A parent with children explains why it stays; Uncategorized shows its reason and no removal.
- [ ] All copied unit tests pass under the new package.
- [ ] `categories.spec.ts` and `category-management.spec.ts` are ported one for one and pass on `phone-chromium`; the legacy copies are deleted.
- [ ] `pnpm run ci` is green.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium categories category-management`.
