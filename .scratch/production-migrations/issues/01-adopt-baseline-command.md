# 01: Adopt the baseline with a checked command

Read `../spec.md` first (Adoption command, Testing Decisions).

**What to build:** `db:adopt-baseline` records `0000_baseline` as applied on
a database that got its schema from `db:push`, but only after proving that
database's schema matches the baseline exactly. `--check` diffs and writes
nothing. A runbook walks the owner through the one production run in 02.

**Blocked by:** None

**Status:** ready-for-agent

**Notes:** Ships alone as PR 1 from `feat/production-migrations`. Nothing here
touches production; the owner runs it in 02.

- [x] `db:adopt-baseline` in `@bookkeeping/database`, with a root script delegating to it, reading the target URL as the other `db:*` scripts do.
- [x] Refuses when the journal holds anything other than `0000_baseline`, and when `drizzle.__drizzle_migrations` exists.
- [x] Applies the baseline to a throwaway Postgres from the image pinned in `apps/backup/Dockerfile`, runs `pg_dump --schema-only --no-owner --no-privileges` from that image against both databases, normalizes, and diffs. A difference prints the diff and exits 1. The container is always removed.
- [x] Without `--check`, writes the `drizzle` schema, migrations table and baseline row in one transaction.
- [x] Integration tests from the spec's Testing Decisions: clean adopt then `migrateDatabase` applies nothing; extra index and missing constraint refused with the diff; existing table refused; second journal entry refused; `--check` writes nothing.
- [x] `runbooks/adopt-production-baseline.md`: manual backup, proxy open with the URL read into a subshell variable and never saved, `--check`, adopt, confirm one row, proxy closed.
- [x] Database package suite and `pnpm run ci` pass.
