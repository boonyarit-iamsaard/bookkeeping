# 14: WebKit rejects an in-flight intent-preload fetch at unload

**What to fix:** `pnpm run ci:e2e` still fails intermittently on
`[phone-webkit] › dashboard.spec.ts › reviews income, expense, refund,
transfer, and wallet balances for chosen dates`. The `afterEach` page-error
check catches one unhandled rejection:

```text
Fetch API cannot load http://localhost:<api>/v1/transactions/<just-saved id>
due to access control checks.
    at y (assets/problem-*.js)   ← ApiProblemError wrapping the fetch failure
    at fetch (assets/index-*.js)
```

**Blocked by:** none

**Status:** needs-triage

## Handoff context (2026-09-22)

This is the residue of the `/diagnose` session on the `ci:e2e` failure.
Commit `bc4f466` (`test: keep browser specs off the service worker and
saved-record races`) fixed the three deterministic causes and took the gate
from 7 failed + 1 flaky to 1 failed; that commit message records them. This
ticket is the one thing left, and it is **pre-existing**: it reproduced once in
a 5× loop before any change was made.

Rate observed: 0/5 in a focused loop, 2/2 attempts in the last full gate —
call it ~1 in 5, phone-webkit only. Chromium never shows it.

### Mechanism established from the trace

1. The test saves a transfer, `expectSavedRecord(page)` passes (URL has
   `?created=`, `[data-saved]` row visible), then `page.goto(...refund)`.
2. The saved row in `transaction-list.tsx` is a `Link` to
   `/transactions/$transactionId`; the router has `defaultPreload: "intent"`
   (`src/core/router/router.ts`). The pointer/touch position left on the Save
   button lands on the newly rendered list, so the link preloads: its route
   loader calls `ensureQueryData(transactionQueries.detail(id))` →
   `GET /v1/transactions/<id>`.
3. `goto` unloads the document while that fetch is in flight. WebKit, unlike
   Chromium, rejects the pending `fetch()` with the "access control checks"
   `TypeError`. The request never reaches the network log (the trace has no
   entry for it), so it is not a real CORS failure.
4. That rejection is unhandled and surfaces as a page error. The trace's
   PAGEERROR sits 120 ms after `Frame.goto` and before the next `fill`.

Not yet established: **who** leaves the promise unhandled. TanStack's `Link`
preload wraps `router.preloadRoute(...)` in a `.catch` that only
`console.warn`s, so the candidates are the router's preload path, React
Query's `ensureQueryData` inside the loader, or the API client's problem
wrapper (`src/core/api/problem.ts`). Instrument the rejection site before
choosing a fix.

### Options (owner's call)

- **App-side:** treat a `TypeError` thrown by `fetch` while the document is
  unloading (`document.visibilityState`/`pagehide` already fired, or simply any
  fetch `TypeError` from a preload) as benign so nothing rejects unhandled.
  Also removes console noise for real Safari users tapping away mid-preload.
- **Test-side:** neutralise the intent preload in the harness — e.g. move the
  pointer off the list after a save inside `expectSavedRecord`, or set
  `defaultPreload` off when `VITE_E2E` is set — and keep the strict page-error
  check as is.

### Feedback loop

```sh
cd apps/web
# ~10 s per test; production build + SW-blocked config, same as CI
pnpm run test:e2e:ci -- tests/e2e/dashboard.spec.ts --project=phone-webkit \
  -g "reviews income" --retries=0 --repeat-each=10 --reporter=line
```

Traces are retained on failure in `test-results/*/trace.zip`. Unzip it;
`*.trace` holds the API calls (`type: "before"`, `apiName`) and
`pageError` events with timestamps; `*.network` holds one JSON line per
request with `startedDateTime` and response status (`-1` = aborted). Sorting
both by time shows what the app was doing when the test navigated away.

Resource rule: browser runs are exclusive on this machine (see `CLAUDE.md`);
do not run the loop alongside Sonar, `pnpm run ci`, or a build.

### Related but not this ticket

TanStack Router's `lazyRouteComponent` reloads the page whenever an aborted
dynamic import surfaces WebKit's `Importing a module script failed`. Real
Safari users navigating away in that ~100 ms window get a reload in place of
their navigation. The specs now avoid it by waiting for the record; the app
itself does nothing about it. Worth an upstream check, not a change here.
