# 16: Replace a wallet opening balance

**What to build:** Let an authenticated client replace a wallet's complete
opening balance resource while preserving financial-date and history rules.

**Blocked by:** 14: Expose wallet list and detail reads

**Status:** ready-for-agent

- [ ] Opening correction moves to the application package with its existing transaction and change-history guarantees.
- [ ] The API replaces amount and opening date together as one subordinate resource.
- [ ] Exact money, future dates, movements before the proposed opening, ownership, and missing wallets map to documented outcomes.
- [ ] Success returns the updated wallet representation and repeat replacement has no additional effect.
- [ ] Existing PostgreSQL tests and new authenticated HTTP contract tests remain green.
