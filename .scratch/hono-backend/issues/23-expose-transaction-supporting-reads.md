# 23: Expose transaction detail and supporting reads

**What to build:** Give authenticated clients the transaction detail and
server-calculated supporting information required by create, edit, and refund
flows.

**Blocked by:** 22: Remove categories with fallback behavior; 11: Mount Better Auth and authenticated context in Hono

**Status:** ready-for-agent

- [ ] Transaction detail, refund allowance, and entry-default queries move to feature subpaths in the application package.
- [ ] Detail responses map money, transaction dates, recording instants, wallets, categories, destinations, and refund links explicitly.
- [ ] Supporting reads provide current owned choices and calculations without exposing internal change history.
- [ ] Missing and cross-owner transaction identifiers are non-disclosing.
- [ ] Runtime schemas, OpenAPI, PostgreSQL tests, and authenticated/unauthenticated HTTP tests cover the reads.
