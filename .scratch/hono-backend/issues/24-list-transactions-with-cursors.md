# 24: List transactions with filters and opaque cursors

**What to build:** Let an authenticated client page through current financial
history using the existing filters without offset-related drift.

**Blocked by:** 23: Expose transaction detail and supporting reads

**Status:** ready-for-agent

- [ ] Transaction listing moves to the application package with deterministic date, recording-time, and identifier ordering.
- [ ] Date, wallet, category, and type filters preserve current transfer, parent-category, refund, and ownership semantics.
- [ ] The API accepts a bounded limit and opaque cursor and returns items with an explicit nullable next cursor.
- [ ] Cursors bind to ordering and active filters and reject malformed or mismatched reuse.
- [ ] Tests cover ties, empty/final pages, inserts before the cursor, limit caps, each filter, and unauthorized access.
