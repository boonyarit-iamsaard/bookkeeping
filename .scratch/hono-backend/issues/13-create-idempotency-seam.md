# 13: Introduce reusable creation idempotency

**What to build:** Provide one application/database mechanism that resource
creation operations can use to turn uncertain retries into a single committed
result.

**Blocked by:** 08: Extract the PostgreSQL database boundary

**Status:** ready-for-agent

- [ ] Idempotency keys are scoped to authenticated owner and operation and bind to a canonical validated payload fingerprint.
- [ ] The receipt and created result commit atomically, including under concurrent requests.
- [ ] Same-key same-payload retries return the original result; changed payloads return an explicit conflict.
- [ ] Validation or application rejection before commit does not consume the key.
- [ ] The mechanism can support wallet, category, and transaction resources without storing presentation DTOs.
- [ ] PostgreSQL integration tests exercise sequential, concurrent, conflict, rollback, and replay cases.
