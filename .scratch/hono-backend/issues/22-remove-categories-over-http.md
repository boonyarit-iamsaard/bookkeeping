# 22: Remove categories with fallback behavior

**What to build:** Let an authenticated client remove eligible categories while
atomically preserving valid categorization for existing transactions.

**Blocked by:** 20: Create categories idempotently over HTTP; 21: Edit categories and inspect their usage

**Status:** ready-for-agent

- [ ] Category removal moves to the application package with existing transaction and locking guarantees intact.
- [ ] Child removal reassigns transactions to its parent; childless parent removal reassigns them to that tree's Uncategorized.
- [ ] Protected, has-children, concurrent in-use, missing, and cross-owner outcomes map to stable Problem Details.
- [ ] Successful removal returns `204` with no body or content type.
- [ ] PostgreSQL concurrency tests and authenticated HTTP tests cover reassignment, rollback, and non-disclosure.
