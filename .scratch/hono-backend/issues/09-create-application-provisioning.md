# 09: Create the application package with category provisioning

**What to build:** Establish the application package through the first real use
case: creating a fresh user's complete default category set safely and repeatedly.

**Blocked by:** 08: Extract the PostgreSQL database boundary

**Status:** ready-for-agent

- [ ] The application package exposes feature-specific source exports and owns application operation contracts.
- [ ] Default-category initialization moves behind a framework-independent application operation.
- [ ] One invocation creates the complete protected/default set in one database transaction.
- [ ] Repeated and concurrent invocations neither duplicate defaults nor overwrite customization.
- [ ] PostgreSQL integration tests prove success, rollback, idempotency, and ownership.
