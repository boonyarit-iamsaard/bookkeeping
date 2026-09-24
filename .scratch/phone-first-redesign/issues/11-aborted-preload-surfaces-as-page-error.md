# 11: An aborted route preload surfaces as a page error on WebKit

**What to build:** A route preload that is cut short by navigation ends
quietly instead of surfacing as an unhandled error.

**Blocked by:** None (can start immediately)

**Status:** needs-triage

**Out of scope:** changing the preload strategy for its own sake.

- [ ] Found by 07's milestone matrix (2026-09-24): `history.spec.ts:20` and `transfers.spec.ts:14` were each flaky once on `phone-webkit` and passed on retry. The `afterEach` page-error check caught "Fetch API cannot load …/v1/categories" and "…/v1/transactions/entry-defaults due to access control checks": the capture route's reads, started by `defaultPreload: "intent"` (`apps/web/src/core/router/router.ts`) when the ＋ link is touched, then cut off by the test's next `page.goto`. WebKit reports the cancelled cross-origin fetch as an access-control failure, and nothing handles the rejection. Not traced to 07's changes; the ＋ link, the capture route and both specs are untouched there.
- [ ] A cancelled preload no longer reaches `pageerror`, and both specs pass on `phone-webkit` without retries.

## Comments
