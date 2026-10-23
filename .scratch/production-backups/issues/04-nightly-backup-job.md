# 04: Run the nightly backup job

Read `../spec.md` first (Backup job, Testing Decisions) and
`docs/adr/0010-protected-main-and-gated-deploys.md` (digest pinning,
Dependabot per Dockerfile directory).

**What to build:** A Railway cron service dumps the whole production database
every night at 03:00 Asia/Bangkok with a manifest from the same snapshot,
encrypts both with the owner's `age` public key, and uploads them to S3. The
first nightly backup is in the bucket.

**Blocked by:** 02 to start, 03 to close

**Status:** done

**Notes:** The agent writes and verifies the job locally with `--local-dir`.
The owner configures the Railway service and sets its variables; the agent
does not handle the AWS secret key.

- [x] `apps/backup/Dockerfile` on `postgres:18-alpine` pinned by tag and index digest, adding `age`, `aws-cli` and `bash`. Railway's build and deploy settings live in the service's dashboard instead of an `apps/backup/railway.json`: Dockerfile path `apps/backup/Dockerfile`, watch path `/apps/backup/**`, cron schedule `0 20 * * *` and restart policy `NEVER`.
- [x] The job exports a `REPEATABLE READ` snapshot, dumps with `pg_dump --format=custom --snapshot`, and builds the manifest (dump time, server version, per-table row count and row checksum in primary-key order) in the same transaction.
- [x] Both files are encrypted with `AGE_RECIPIENT` and uploaded to `daily/YYYY-MM-DD/`, and on the first of the month also to `monthly/YYYY-MM/`; dates are Asia/Bangkok.
- [x] Any failure exits non-zero; no plaintext is written outside the container's temporary directory; no secret is logged.
- [x] `--local-dir <path>` writes the encrypted files to a directory instead of S3.
- [x] Verified locally: the image built and run with `--local-dir` against a local PostgreSQL 18 database built by `db:migrate` and seeded with a few rows; both files decrypt with a throwaway key; the manifest's counts match the seed.
- [x] `.github/dependabot.yml` has a `docker` entry for `/apps/backup` with a three-day cooldown, ignoring `postgres` major updates.
- [x] Owner: Railway service `backup` configured in its dashboard with the settings above and the spec's variables, and no public networking; one run triggered by hand succeeds.
- [x] The first scheduled run's objects appear in S3; date recorded under Comments.

## Comments

### 2026-10-18: Dashboard settings instead of `railway.json`

Railway has deprecated config as code. Its docs say new services cannot opt
into `railway.json`, and existing files stop being read on 2026-12-01. The
`backup` service was created in 03, so it is new, and the owner chose to
configure it in the dashboard. Moving the server and web services off config
as code before the cutoff is `../../deployment/issues/06-move-off-railway-config-as-code.md`.

The `backup` service's settings:

- Source: this repository, branch `main`, root directory unset, so the build
  context is the repository root.
- Builder: Dockerfile, with Dockerfile Path `/apps/backup/Dockerfile`. The
  field only suggests Dockerfiles already on `main`, so type it in before
  this branch merges.
- Watch paths: `/apps/backup/**`.
- Wait for CI: on, as for the server and web services (ADR 0010).
- Cron schedule: `0 20 * * *`, which is 03:00 Asia/Bangkok.
- Restart policy: Never.
- Networking: no public domain.
- Variables: `DATABASE_URL` as a reference to the Postgres service's private
  `DATABASE_URL`, `AGE_RECIPIENT` (the replacement public key, not the one
  exposed on 2026-10-17), `BACKUP_BUCKET` (the stack's `BucketName` output),
  `AWS_REGION=ap-southeast-1`, and the uploader's `AWS_ACCESS_KEY_ID` and
  `AWS_SECRET_ACCESS_KEY`, which are already set.

### 2026-10-18: Built and verified locally

`apps/backup/backup.sh` runs the job, and `apps/backup/manifest.sql` is the
manifest query, kept apart so ticket 06's drill can run the same query
against the restored database. One psql session holds the `REPEATABLE READ
READ ONLY` transaction open while `pg_dump` reads its exported snapshot. The
dump goes straight through a pipe into `age`, and the manifest stays in
memory, so no plaintext touches disk at all. The checksum is an MD5 of each
table's row text in primary-key order. The query pins `TimeZone`,
`DateStyle`, `IntervalStyle`, `extra_float_digits` and `bytea_output`,
because row text depends on them.

The image is `postgres:18-alpine` on Alpine 3.24 with pg_dump 18.6, `age`
1.3.2 and `aws-cli` 2.34.63. Checks against a throwaway PostgreSQL 18
database, migrated and seeded with 1 user, 2 wallets, 3 categories and 1
transaction:

- `--local-dir` exited 0, and both files decrypted with a throwaway key. The
  manifest's counts matched the seed, and the dump held 11 tables of data,
  including Drizzle's migrations table.
- The dump restored into a fresh database, and the manifest recomputed there
  matched the original for every table.
- A missing variable, a bad recipient, a bad password, an unknown host, an
  unwritable directory and an unreachable S3 endpoint each exited 1. None of
  the logs showed a password or key.
- With `date` and `aws` stubbed, 2026-11-01 uploaded under `daily/2026-11-01/`
  and `monthly/2026-11/`, and 2026-10-19 under `daily/` only.
- From 03: the job passes `--checksum-algorithm CRC64NVME` explicitly rather
  than relying on the CLI's default. Alpine's CLI accepted the flag. The
  first manual run on Railway proves that S3 accepts the upload.

### 2026-10-18: Service deployed and first manual run

PR #31 merged at 12:36 UTC. The owner configured the `backup` service in
the dashboard with the settings above (restart policy was already Never),
0.5 vCPU and 500 MB, and `DATABASE_URL` as `${{database.DATABASE_URL}}`.
The build pulled the pinned digest and installed `age` 1.3.2-r1 and
`aws-cli` 2.34.63-r0. A run triggered by hand at 12:55 UTC took 7 seconds:

```text
exported snapshot
dumped and encrypted the database
built and encrypted the manifest
uploaded to daily/2026-10-18/
```

The upload closes 03's checksum question: S3 accepted the explicit
`CRC64NVME` checksum on the Object Lock bucket. Railway labels the progress
lines `[err]` because the job logs to stderr. The first scheduled run is at
20:00 UTC, 03:00 on 2026-10-19 in Bangkok.

### 2026-10-19: First scheduled run in S3

The Railway `backup` service ran on its cron schedule and completed in 6
seconds. S3 holds `daily/2026-10-19/bookkeeping.dump.age` (46.5 KB) and
`daily/2026-10-19/manifest.json.age` (1.1 KB), both in Standard storage. The
timestamps are 03:04 Asia/Bangkok, four minutes after the 20:00 UTC trigger.

### 2026-10-19: Closed as done

All acceptance criteria are met. The job was built in `ab86a12` (#31).
`ce441b9` records the first manual Railway run, and `903a67b` records the
first scheduled run's objects in S3, both above; both merged as `03b5f05`
(#42). Ticket 03 is still
`ready-for-human` with its AWS cost note open, so the spec's "03 to close"
dependency is not yet satisfied; the owner accepted closing 04 regardless.
