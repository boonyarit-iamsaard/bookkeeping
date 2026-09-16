# 20: Create categories idempotently over HTTP

**What to build:** Let an authenticated client create parent or child categories
safely across retries while preserving tree and uniqueness rules.

**Blocked by:** 13: Introduce reusable creation idempotency; 19: Expose category trees as read-only resources

**Status:** ready-for-agent

- [ ] Category creation moves to the application package with one owner for normalization and validation.
- [ ] Parent and child creation enforce kind, parent ownership, depth, name, icon, protected-category, and scoped uniqueness rules.
- [ ] Creation requires an idempotency key and supports replay, changed-payload conflict, and concurrent requests.
- [ ] Success returns `201`, the direct category representation, and its location.
- [ ] PostgreSQL and HTTP contract tests cover authenticated, invalid, duplicate, cross-owner, and idempotent outcomes.
