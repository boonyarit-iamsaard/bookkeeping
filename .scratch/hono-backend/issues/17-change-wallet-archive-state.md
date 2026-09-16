# 17: Archive and restore wallets as state changes

**What to build:** Let an authenticated client change whether a wallet is
archived without introducing command-style action routes.

**Blocked by:** 14: Expose wallet list and detail reads

**Status:** ready-for-agent

- [ ] Wallet archive behavior moves to the application package and stays atomic with internal history.
- [ ] A partial wallet update accepts the documented archived state and rejects unrelated or malformed changes.
- [ ] Archive, restore, repeated state, missing resource, and cross-owner behavior have stable responses.
- [ ] Success returns the updated wallet representation.
- [ ] Application and HTTP tests preserve the existing restrictions on new entries involving archived wallets.
