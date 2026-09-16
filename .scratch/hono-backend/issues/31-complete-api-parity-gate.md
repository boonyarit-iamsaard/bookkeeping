# 31: Complete the API-parity and workspace gate

**What to build:** Close the initiative by proving that Hono covers every
current user-visible backend behavior and that the extracted workspace has no
temporary ownership leaks.

**Blocked by:** 12: Retry interrupted fresh-user provisioning; 15: Create wallets idempotently over HTTP; 16: Replace a wallet opening balance; 17: Archive and restore wallets as state changes; 18: Delete eligible wallets over HTTP; 19: Expose category trees as read-only resources; 20: Create categories idempotently over HTTP; 21: Edit categories and inspect their usage; 22: Remove categories with fallback behavior; 23: Expose transaction detail and supporting reads; 24: List transactions with filters and opaque cursors; 25: Create income and expenses idempotently; 26: Create wallet transfers over HTTP; 27: Create linked refunds over HTTP; 28: Update transactions over HTTP; 29: Delete transactions over HTTP; 30: Expose monthly financial summaries

**Status:** ready-for-agent

- [ ] A behavior inventory maps every current user-visible backend flow to a tested Hono operation or an explicit out-of-scope decision.
- [ ] OpenAPI generation and response-schema contract tests cover every published operation and Problem Details variant.
- [ ] Temporary forwarding exports are removed after all consumers use package public subpaths; no business operation has duplicate ownership.
- [ ] Root scripts, Turbo tasks and outputs, environment examples, CI, static-analysis scope, and contributor documentation reflect both apps and all packages.
- [ ] Formatting, linting, type checks, package tests, PostgreSQL integration tests, both app builds, Hono contract tests, and the retained Next.js browser suite pass in a resource-safe sequence.
- [ ] Next.js remains a working temporary adapter; no SPA migration or Next.js removal is included.
