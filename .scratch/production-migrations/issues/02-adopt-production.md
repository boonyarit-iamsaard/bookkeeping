# 02: Adopt production's schema

Read `../spec.md` first, then `../runbooks/adopt-production-baseline.md`.

**What to do:** The owner runs ticket 01's command against production, once,
following the runbook.

**Blocked by:** 01

**Status:** ready-for-human

**Notes:** Writes to the production database, so it needs the owner's
explicit go-ahead. The database URL is read into a subshell and never written
to a file or pasted into a conversation. After this, committed migrations are
immutable; tickets 03–05 start from here.

- [ ] Manual backup run triggered outside 20:00–20:59 UTC; its `manual/<stamp>/` prefix noted under Comments.
- [ ] `db:adopt-baseline --check` against production prints no diff.
- [ ] `db:adopt-baseline` against production succeeds.
- [ ] `drizzle.__drizzle_migrations` holds exactly one row; its hash noted under Comments.
- [ ] TCP proxy disabled.
