# 02: Adopt production's schema

Read `../spec.md` first, then `../runbooks/adopt-production-baseline.md`.

**What to do:** The owner runs ticket 01's command against production, once,
following the runbook.

**Blocked by:** 01

**Status:** done

**Notes:** Writes to the production database, so it needs the owner's
explicit go-ahead. The database URL is read into a subshell and never written
to a file or pasted into a conversation. After this, committed migrations are
immutable; tickets 03–05 start from here.

- [x] Manual backup run triggered outside 20:00–20:59 UTC; its `manual/<stamp>/` prefix noted under Comments.
- [x] `db:adopt-baseline --check` against production prints no diff.
- [x] `db:adopt-baseline` against production succeeds.
- [x] `drizzle.__drizzle_migrations` holds exactly one row; its hash noted under Comments.
- [x] TCP proxy disabled.

## Comments

2026-10-31: Done by the owner on `main` at 0b1ff2f (PR #65), following
`../runbooks/adopt-production-baseline.md`.

- Manual backup at 03:29 UTC: `uploaded to manual/2026-10-31T032934Z/`.
- `--check`: `The schema matches 0000_baseline. Nothing was written.`
- Adopt: `Adopted: drizzle.__drizzle_migrations records 0000_baseline as applied.`
- One row: `1|07198170bfd34efc095de98f580be2c3573c16b9652b9efd8d7e53cbc53861cf|1790521579298`,
  matching `sha256sum` of `0000_baseline.sql` and the journal's `when`.
- TCP proxy removed: `DATABASE_PUBLIC_URL` no longer set on `database`.

Committed migrations are immutable from here.
