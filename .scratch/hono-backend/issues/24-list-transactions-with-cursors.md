# 24: List transactions with filters and opaque cursors

**What to build:** Let an authenticated client page through current financial
history using the existing filters without offset-related drift.

**Blocked by:** 23: Expose transaction detail and supporting reads

**Status:** resolved

- [ ] Transaction listing moves to the application package with deterministic date, recording-time, and identifier ordering.
- [ ] Date, wallet, category, and type filters preserve current transfer, parent-category, refund, and ownership semantics.
- [ ] The API accepts a bounded limit and opaque cursor and returns items with an explicit nullable next cursor.
- [ ] Cursors bind to ordering and active filters and reject malformed or mismatched reuse.
- [ ] Tests cover ties, empty/final pages, inserts before the cursor, limit caps, each filter, and unauthorized access.

## Comments

**2026-09-20 — closed.** Resolved in `d3d0030` (feat: list transactions with cursor pagination). Status line was stale after the commit landed.
