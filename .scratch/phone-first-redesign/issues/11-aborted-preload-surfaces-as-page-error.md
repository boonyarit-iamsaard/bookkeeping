# 11: An aborted route preload surfaces as a page error on WebKit

**What to build:** A route preload that is cut short by navigation ends
quietly instead of surfacing as an unhandled error.

**Blocked by:** None (can start immediately)

**Status:** done

**Out of scope:** changing the preload strategy for its own sake.

- [x] Found by 07's milestone matrix (2026-09-24): `history.spec.ts:20` and `transfers.spec.ts:14` were each flaky once on `phone-webkit` and passed on retry. The `afterEach` page-error check caught "Fetch API cannot load …/v1/categories" and "…/v1/transactions/entry-defaults due to access control checks": the capture route's reads, started by `defaultPreload: "intent"` (`apps/web/src/core/router/router.ts`) when the ＋ link is touched, then cut off by the test's next `page.goto`. WebKit reports the cancelled cross-origin fetch as an access-control failure, and nothing handles the rejection. Not traced to 07's changes; the ＋ link, the capture route and both specs are untouched there.
- [x] A cancelled preload no longer reaches `pageerror`, and both specs pass on `phone-webkit` without retries.

## Comments

### 2026-09-24: fixed test-side

The preload came from `createWalletThroughForm`. Its Create wallet button is
fixed full-width along the bottom of the phone screen, and on `/wallets` the
tab bar's ＋ renders under the same point: a probe read the element under the
click point after each save as the `/transactions/new` link in all three of
`transfers.spec.ts`'s wallets. The stationary test pointer then starts the
capture route's intent preload, and the spec's next `page.goto` cuts it off.
This is the mechanism already closed for saved rows in spa-client 14, which
established that no app promise is left unhandled.

The fix follows that ticket: a shared `parkPointer` helper moves the pointer
off after the Create wallet click, and `expectSavedRecord` now uses it too.
This narrows the "What to build" line: production preload behavior is
unchanged, because the rejection is WebKit's own teardown report rather than
an app promise, so there is nothing app-side to end quietly. `wallets.spec.ts`
clicks the same Create wallet button inline and now parks too. Both specs on `phone-webkit`,
`--repeat-each=10 --retries=0`: 20 of 20 passed with no page errors.

A separate flake showed once in the baseline loop (1 of 16): `history.spec.ts`
`page.reload` failed with "Frame load interrupted" after WebKit logged
"Importing a module script failed". The pointer there rests on no link, so it
is not this mechanism; it matches the router's reload on an aborted chunk
import noted under spa-client 14's "Related but not this ticket".
