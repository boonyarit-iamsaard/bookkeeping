# 30: Expose monthly financial summaries

**What to build:** Let an authenticated client retrieve server-calculated
monthly totals without reproducing financial rules in the client.

**Blocked by:** 24: List transactions with filters and opaque cursors; 29: Delete transactions over HTTP

**Status:** ready-for-agent

- [ ] Monthly summary behavior moves to the application package with Bangkok calendar boundaries intact.
- [ ] The versioned report resource returns income, gross expenses, refunds, net expenses, and net as canonical Money objects.
- [ ] Transfers and opening balances remain excluded and refunds count in their transaction month.
- [ ] Invalid months, unauthenticated requests, empty months, and large exact aggregates have documented responses.
- [ ] PostgreSQL, runtime-schema, OpenAPI, and HTTP tests verify the report contract.
