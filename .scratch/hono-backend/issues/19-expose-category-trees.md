# 19: Expose category trees as read-only resources

**What to build:** Let an authenticated client retrieve its income and expense
category trees without reads creating or modifying defaults.

**Blocked by:** 12: Retry interrupted fresh-user provisioning; 15: Create wallets idempotently over HTTP; 16: Replace a wallet opening balance; 17: Archive and restore wallets as state changes; 18: Delete eligible wallets over HTTP

**Status:** ready-for-agent

- [ ] Category query behavior moves to the application package and remains shared with Next.js.
- [ ] Versioned category reads return owned parent/child trees and protected-category metadata without pagination.
- [ ] Reads are side-effect free even when provisioning is incomplete.
- [ ] Session ownership, unauthenticated rejection, runtime schemas, and OpenAPI are verified through HTTP tests.
- [ ] Existing ordering and selection behavior remains unchanged.
