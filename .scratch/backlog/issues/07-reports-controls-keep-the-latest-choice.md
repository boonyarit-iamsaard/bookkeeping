# 07: Reports controls keep the latest choice

**What to build:** On Reports, the month picker and the balance date each
apply on pick and change only their own value, keeping the other from the
address. Each keeps the other from the report on show, though, not from the
address. After a month pick, the previous month's report stays on show until
the new one loads. A balance date picked in that window rebuilds the address
with the old month and undoes the month pick. A month picked while a new
balance date loads undoes the date in the same way. Build each control's
next address from the latest address, so a pick made during a load keeps the
other control's newest value. An invalid value still stays in the address
until corrected.

The race showed up as the flaky step in the reports browser spec that picks
September 2026 and then the 3 Sep 2026 balance date. The URL came back with
`month=2026-08`. It passed on retry.

**Blocked by:** None (can start immediately).

**Status:** done (72718e0)

- [x] Picking a month and then a balance date before the month's report has
      loaded leaves the address with both new values.
- [x] Picking a balance date and then a month before the balance date's
      report has loaded leaves the address with both new values.
- [x] A browser test holds back the report read for the new value, makes the
      second pick during the load, and asserts the address keeps both values.
- [x] A malformed month or balance date in the address still stays visible
      and editable when the other control changes.
- [x] The existing reports spec passes without a retry.

## Comments

Cause: each control rebuilt the address from `Route.useSearch()`, which
returns the rendered match's search while the new match's loader is pending.
Both controls now pass a functional `search`, which the router resolves
against the pending (latest) location. `reports-controls.spec.ts` holds back
the new value's read and makes the second pick during the load, in both
orders; both tests failed every run without the fix. The existing reports
spec passed 13 of 14 runs with retries off and then 12 in a row; the one
failure was an early `toBeVisible` on a cold run, not the URL symptom, and its
trace was lost.
