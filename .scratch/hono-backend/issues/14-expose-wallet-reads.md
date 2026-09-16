# 14: Expose wallet list and detail reads

**What to build:** Let an authenticated API client retrieve its wallet
collection and an individual wallet using the same balance behavior as the
existing UI.

**Blocked by:** 11: Mount Better Auth and authenticated context in Hono; 08: Extract the PostgreSQL database boundary; 06: Extract exact values and wallet vocabulary

**Status:** ready-for-agent

- [ ] Wallet read operations and their PostgreSQL tests move to the application package without changing the Next.js UI.
- [ ] Versioned collection and individual resource routes derive ownership only from the session.
- [ ] Money responses use exact major-unit decimal strings with explicit THB currency.
- [ ] Missing and cross-owner wallet identifiers return the same non-disclosing not-found problem.
- [ ] Runtime schemas, OpenAPI, and authenticated/unauthenticated HTTP tests cover both routes.
