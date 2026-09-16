# 06: Extract exact values and wallet vocabulary

**What to build:** Establish the framework-independent domain package with the
exact values and wallet language needed by both applications and persistence.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Result, money, currency, and calendar-date behavior has one owner in the domain package.
- [x] Wallet value sets and types move without changing observable behavior.
- [x] Money parsing and formatting retain exact `bigint` behavior and all existing limits.
- [x] Public exports are narrow feature subpaths rather than a root barrel.
- [x] The web app and existing tests consume the new ownership while remaining green.
