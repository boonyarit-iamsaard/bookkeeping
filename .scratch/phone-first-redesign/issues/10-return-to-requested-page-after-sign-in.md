# 10: Return to the requested page after sign-in

Read `../spec.md` first (Routes).

**What to build:** A signed-out visit to a signed-in address, such as
`/reports?month=2026-09`, lands back on that address after sign-in instead
of on Home.

**Blocked by:** 07 (Avatar menu, the Categories entry, and the milestone check)

**Status:** needs-triage

**Out of scope:** sign-up, which starts a new Account and lands on Home.

- [ ] Raised during 07's grilling (2026-09-24), which sends every sign-in to Home. The return address must be internal only; the capture-origin resolver from 04 is the likely prior art.

## Comments
