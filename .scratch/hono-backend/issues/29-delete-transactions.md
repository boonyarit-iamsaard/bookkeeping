# 29: Delete transactions over HTTP

**What to build:** Let an authenticated client remove a mistaken transaction
from normal financial history while retaining the established internal record.

**Blocked by:** 28: Update transactions over HTTP

**Status:** ready-for-agent

- [ ] Transaction deletion moves to the application package and writes internal history atomically with the soft deletion.
- [ ] Deleting income, expenses, transfers, and refunds removes their current financial effects correctly.
- [ ] Expenses with refunds remain protected by a stable conflict problem.
- [ ] Eligible deletion returns `204`; repeat, missing, unauthenticated, and cross-owner requests follow the documented non-disclosing contract.
- [ ] PostgreSQL and HTTP tests verify balances, history, linked constraints, rollback, and response semantics.
