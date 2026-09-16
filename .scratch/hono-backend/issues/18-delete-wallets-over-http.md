# 18: Delete eligible wallets over HTTP

**What to build:** Let an authenticated client permanently remove only wallets
whose current and retained history permits deletion.

**Blocked by:** 14: Expose wallet list and detail reads

**Status:** ready-for-agent

- [ ] Wallet deletion moves to the application package without weakening retained-history checks.
- [ ] Eligible deletion returns `204` with no body or content type.
- [ ] Current transactions, wallet changes, and retained transaction snapshots prevent deletion through a stable conflict problem.
- [ ] Missing and cross-owner resources remain non-disclosing.
- [ ] PostgreSQL and HTTP tests cover eligible, blocked, repeated, unauthenticated, and cross-owner requests.
