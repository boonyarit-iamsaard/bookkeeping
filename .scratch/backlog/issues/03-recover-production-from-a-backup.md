# 03: Recover production from a backup

Read `../../production-backups/spec.md` first, and ADRs 0008, 0009 and 0013.

**What to build:** The owner can bring production back from an S3 backup by
following a written procedure, and has rehearsed it once against a disposable
database.

**Blocked by:** None. It **blocks** `production-migrations`: ADR 0009 undoes a
bad migration by restoring a backup, and nothing yet says how.

**Status:** needs-triage

**Notes:** Undecided. Settle the questions below with `/grill-with-docs`, then
write the spec and tickets in the same session. The restore drill proves a
backup restores into a throwaway container; this is the step after it. The
production-backups spec rules out only automatic or one-click restore.

Questions for the grilling:

1. **Target.** The same Railway Postgres (a bad migration or corrupted data),
   a new Railway database, or another provider after losing the Railway
   account, which is ADR 0008's reason for off-site backups.
2. **Access.** Postgres has no TCP proxy on purpose, so `pg_restore` from the
   owner's machine can't reach it. Choose between a temporary proxy removed
   afterwards, `railway ssh` into a service, or a one-off restore service
   inside the project.
3. **Rows written after the backup.** Re-enter them by hand, or dump the
   damaged database first and salvage them.
4. **Order.** Stop the API so nothing writes, restore, check the restored
   production database with the drill's manifest comparison, restart.
5. **Downtime.** Up to a day of lost data is accepted; how long recovery may
   take is not stated.

## Comments

### 2026-10-22: deferred to the backlog

Raised after the first restore drill passed. Deferred for higher-priority
work; the owner chose a backlog ticket over a spec, because the questions
above are not yet decided.
