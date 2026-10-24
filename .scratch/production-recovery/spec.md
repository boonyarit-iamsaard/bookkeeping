# Recover production from a backup

Status: done

Decided on 2026-10-23 by grilling, from
`../backlog/issues/03-recover-production-from-a-backup.md`. Read
`../production-backups/spec.md` first, and ADRs 0008, 0009 and 0013. This
spec blocks `production-migrations`: ADR 0009 undoes a bad migration by
restoring a backup, and until now nothing said how.

## Problem Statement

Nightly encrypted backups reach S3, and the restore drill proves that one
restores into a throwaway container on the owner's machine. Nothing yet brings
production back from one. The production database has no TCP proxy, so
`pg_restore` on the owner's machine cannot reach it, and the private key that
decrypts a backup must not go to Railway. The backups spec rules out only an
automatic or one-click restore; it leaves the procedure, the target, the rows
written after the backup and the downtime undecided.

## Vocabulary

These are operations terms, so they live here and not in `CONTEXT.md`:

- **Restore drill:** restoring a backup into a throwaway container and
  checking it against its manifest, to prove the backup is sound. It never
  touches production.
- **Recovery:** bringing production back from a backup, by the procedure in
  this spec.
- **Recovery rehearsal:** a full recovery run against a temporary Railway
  project instead of production.
- **Damaged database:** the production database as it stands when recovery
  starts, renamed `railway_damaged` by the swap.

## Solution

A `restore.sh` script on the owner's machine restores a named backup into a
new database at a URL the owner gives it, and checks it against the backup's
manifest. It never drops, renames or overwrites anything. A written runbook
wraps it: stop the API, open a temporary TCP proxy, dump the damaged database,
restore beside it, swap the database names by hand, check again, bring the API
back with a deploy, remove the proxy, and salvage the rows recorded after the
backup through the app. The owner rehearses the runbook once against a
temporary Railway project.

## User Stories

1. As the owner, I want a written recovery procedure, so that a bad migration or corrupted data doesn't leave me improvising on the day.
2. As the owner, I want the private key never to leave my machine during recovery, so that recovering doesn't weaken what keeps the backups private.
3. As the owner, I want production changed only after the restored copy matches its manifest, so that a failed restore leaves the damaged database as it was.
4. As the owner, I want the damaged database kept until I've salvaged it, so that entries made after the backup are not lost.
5. As the owner, I want to choose which backup to restore, so that I can recover from a mistake I notice weeks later.
6. As the owner, I want the same procedure to work on a new Railway project, so that losing the Railway account is recoverable too.
7. As the owner, I want to rehearse recovery once without touching production, so that I trust it and know how long it takes.

## Implementation Decisions

### Targets

- **The same Railway Postgres**, after a bad migration or corrupted data, is
  covered fully.
- **A new Railway project or account**, after losing the Railway account
  (ADR 0008's reason for off-site backups): the owner creates an empty
  Railway Postgres and rebuilds the services, variables and domains from
  their own records, then follows the same restore steps. The swap is
  skipped because there is no damaged database.
- **Another provider** is out of scope: moving hosts is a hosting decision,
  not a recovery.

### Access

- A temporary TCP proxy on the Postgres service, opened only for the
  recovery and removed at the end, as the deployment runbook's stage 10 did
  for `db:push`. ADR 0013 records this as an amendment.
- Decryption and `pg_restore` run on the owner's machine with
  `sslmode=require`. The private key never leaves it.
- Rejected: `railway ssh`, which would need the plaintext dump piped through
  an interactive session, unproven for binary data; and a one-off restore
  service inside the project, which would need the private key, or a second
  key pair, on Railway.

### `restore.sh`

- Lives in `apps/backup/` beside the drill. The drill's fetch, version check,
  decrypt and manifest comparison move into `common.sh`, and both scripts
  use them.
- Takes `--identity <age identity file>`, `--backup <prefix>` naming one
  `daily/`, `monthly/` or `manual/` backup (or `--local-dir <path>`), and the
  target database URL, read at a hidden prompt or from the environment, never
  as an argument, so it stays out of shell history.
- There is no default backup. Without `--backup`, it prints the newest
  `daily/` prefix as a suggestion and exits.
- Refuses, as the drill does, a backup whose dump or manifest has more than
  one S3 version, or whose date is after today in Bangkok.
- Refuses a target database that already exists. It creates the database,
  streams the decrypted dump into `pg_restore --exit-on-error`, rebuilds the
  manifest with `manifest.sql`, and compares it with the backup's. It exits
  non-zero, naming each differing table, on any mismatch.
- A separate `--check` mode compares an existing database at a URL with a
  named backup's manifest without restoring anything, for the check after the
  swap.
- `pg_restore` and `psql` run from the job's pinned `postgres:18-alpine`
  image through Docker, so the owner needs no local PostgreSQL client and
  restores with the version that dumped.
- No decrypted file is written to disk, as in the drill.

### Recovery procedure

The runbook lists these steps; the owner runs every one and the agent checks
only read-only:

1. Start outside 20:00–20:59 UTC, so the `backup` cron doesn't dump a
   half-recovered database.
2. Remove the API's active deployment in the Railway dashboard. The API
   errors until the next deploy, and nothing writes to the database.
3. Open the TCP proxy.
4. Dump the damaged database with `pg_dump`, encrypted to the owner's `age`
   public key, onto the owner's machine.
5. Run `restore.sh` with the chosen backup into a new database,
   `railway_restored`.
6. Swap the names by hand in `psql`, connected to the `postgres` database
   with nothing else connected: `railway` becomes `railway_damaged`, then
   `railway_restored` becomes `railway`. Swapping back undoes it.
7. Run `restore.sh --check` against `railway`.
8. Bring the API back with a deploy. After a bad migration, merge the PR
   that reverts it, so that the code matches the restored schema; after
   corrupted data with no code change, redeploy the current deployment.
   Restored data under a newer API is a second outage.
9. Check `/health` and sign in on the phone.
10. Remove the TCP proxy and confirm it is gone.
11. Salvage: find the transactions in `railway_damaged` recorded after the
    manifest's `dumpedAt`, and enter them again through the app, so that
    balances and change history stay correct. No automated merge.
12. Trigger a backup by hand, which writes under `manual/`.
13. Drop `railway_damaged` and delete the local dump from step 4.

Production's database name is assumed to be Railway's default, `railway`;
ticket 02 confirms it.

### Downtime

No formal target. Recovery of the same database should finish the same day;
after losing the account, within a few days. The rehearsal records how long
the hands-on steps took, and the runbook states that as the expectation.

### Rehearsal

- Once, against a temporary Railway project with one Postgres and one
  placeholder service standing in for the API, restoring a real backup and
  following the runbook end to end, including the proxy, the swap and both
  manifest checks. The temporary project is deleted afterwards, so the real
  ledger sits in a second Railway project only for the rehearsal.
- Repeated only when the runbook or `restore.sh` changes materially. The
  quarterly restore drill keeps proving the backups themselves.
- Recorded under this spec's Comments with the date, the backup restored and
  the time taken.

## Testing Decisions

- `restore.sh` is tested end to end, like the drill: run `backup.sh
--local-dir` against a local PostgreSQL 18 database built by `db:migrate`
  and seeded with a few rows, then restore that directory into a second
  local PostgreSQL container through its URL.
- It must pass on the unchanged backup, and fail after one manifest value or
  one restored row is changed. It must refuse a target database that exists,
  and with a stubbed `aws`, a backup with a second version, a delete marker
  or a future date. `--check` must pass on a matching database and fail on a
  changed one.
- The drill's existing checks still pass after the shared code moves into
  `common.sh`.
- The runbook is proven by the rehearsal, not by tests.

## Out of Scope

- Moving to another hosting provider.
- Automatic or one-click recovery, including a script that performs the
  swap or touches Railway.
- Point-in-time recovery or WAL archiving (ADR 0013).
- Merging the rows written after the backup automatically.
- Recovery of anything but the database: images are rebuilt from the
  repository and variables come from the owner's records.

## Order of tickets

01 first. 02 follows 01. 03 (owner) follows 02 and closes this spec, which
unblocks `production-migrations`.

## Comments

### 2026-10-24: Recovery rehearsal

| Date       | Backup              | Dumped at (UTC)             | Hands-on time | Result                  |
| ---------- | ------------------- | --------------------------- | ------------- | ----------------------- |
| 2026-10-24 | `daily/2026-10-21/` | 2026-10-20T20:04:20.449119Z | 22 minutes    | Passed: 10 tables match |

The runbook now expects about 30 minutes on the same database. Ticket 03
closes this spec, and with it the recovery blocker on
`production-migrations`. Repeat the rehearsal only when the runbook or
`restore.sh` changes materially.
