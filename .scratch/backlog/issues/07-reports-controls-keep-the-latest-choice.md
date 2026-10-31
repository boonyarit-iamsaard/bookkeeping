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

**Status:** ready-for-agent

- [ ] Picking a month and then a balance date before the month's report has
      loaded leaves the address with both new values.
- [ ] Picking a balance date and then a month before the balance date's
      report has loaded leaves the address with both new values.
- [ ] A browser test holds back the report read for the new value, makes the
      second pick during the load, and asserts the address keeps both values.
- [ ] A malformed month or balance date in the address still stays visible
      and editable when the other control changes.
- [ ] The existing reports spec passes without a retry.
