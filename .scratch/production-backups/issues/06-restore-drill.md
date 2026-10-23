# 06: Prove a backup restores

Read `../spec.md` first (Restore drill, Testing Decisions).

**What to build:** A drill script on the owner's machine restores the newest
nightly backup into a throwaway PostgreSQL 18 container and proves it matches
its manifest. The first passing drill closes this spec.

**Blocked by:** 04

**Status:** done

**Notes:** The agent writes and verifies the script against local backups
from 04's `--local-dir`. Only the owner runs it against S3, because only the
owner holds the private key and the read access.

- [x] Script in `apps/backup/` taking the newest `daily/` backup from S3 with `--profile bookkeeping-backups`, or a directory with `--local-dir`, plus the path to the `age` identity file.
- [x] Restores with `pg_restore` into a throwaway `postgres:18-alpine` container pinned by digest, recomputes the manifest exactly as the job does, and compares every table's row count and checksum.
- [x] Exits non-zero and names the differing tables on any mismatch; removes the container and the plaintext files whether it passes or fails.
- [x] Against S3, refuses before restoring when the chosen backup's dump or manifest has more than one object version, naming the key: a leaked uploader key can add a newer version, encrypted to the public `AGE_RECIPIENT`, that the drill would otherwise restore and pass.
- [x] Verified locally against a `--local-dir` backup from 04: passes unchanged, fails after one restored row or one manifest value is altered.
- [x] Owner: drill run against the newest S3 backup and passed; date and backup key recorded under this spec's Comments, with the next drill due in three months.
- [x] Spec status set to `done`, and the `production-migrations` spec unblocked.

## Comments

### 2026-10-18: README drift from the branch review

The review of `feat/production-backups` before the 04 merge found README
sections that the branch outdated. Fix them in this ticket's pull request:

- "Local SonarQube" omits `infra/aws`, which `sonar-project.properties` now
  scans.
- "Dependency updates" says both Dockerfiles pin by digest; there are now
  three, and the `postgres` major ignore for `/apps/backup` is not mentioned.
- "Project structure" lists neither `apps/backup/` nor `infra/aws/`.

### 2026-10-22: Version check from the Railway incident

Railway disclosed on 2026-10-21 that customer environment variables, which
hold the uploader key, may have been read. The bucket showed one version per
key and no planted objects, but the drill restores whatever version is
current, so it gains the version-count criterion above. See
`.scratch/railway-incident-2026-10-21/spec.md`.

### 2026-10-22: Drill written and verified locally

`apps/backup/restore-drill.sh` takes `--identity`, and either `--local-dir` or
an AWS profile, `bookkeeping-backups` by default. It reads the bucket from the
stack's `BucketName` output and picks the newest `daily/` date holding any
file, so a night missing its dump or manifest fails instead of falling back
to an older backup. It refuses that backup when either file has more than one
version, counting delete markers, or when its date is after today in Bangkok:
a planted future date would otherwise be newest and have one version. The
date check goes beyond the criterion and was added for the same threat. It
downloads each file by its version ID. The restore image is read from the
`FROM` line of the job's Dockerfile, so Dependabot moves both together. The
container runs with `--network none` and trust auth, and is removed with its
volume on exit, including Ctrl-C. The dump streams from `age` into
`pg_restore` and the manifest stays in memory, so no decrypted file is ever
written. The manifests are compared in the container with `jsonb_each`, one
line per table that differs or exists on one side only.

Known limits:

- A key planted under today's date before that night's 03:00 Bangkok run has
  one version until the job writes the second, so a drill run in that window
  would restore it. The next run makes it refused.
- The manifest orders rows by primary key, or by row text when a table has
  none. Every `public` table has a `uuid` primary key, so collation can't
  change a checksum today. A future table keyed by text, or without a key,
  could fail the drill falsely if production's collation differs from the
  image's.

Checks, with the job image built from this branch, a throwaway `age` key, and
a PostgreSQL 18 database migrated by `db:migrate` and seeded with a user, a
verification and a creation receipt:

- The unchanged `--local-dir` backup passed: 10 tables match.
- With the manifest's `users` row count changed from 1 to 2 and re-encrypted,
  the drill exited 1 and named `users`.
- For one changed restored row, a verification row was updated after the
  backup and a second backup taken; its dump with the first backup's manifest
  exited 1 and named `verifications`. The two dumps differ only in that row,
  so this stands in for editing the restored database, which the drill never
  pauses to allow.
- With a stubbed `aws`: one version each passed; two dump versions, two
  manifest versions, a delete marker, a date of 2099-01-01, a missing dump and
  a missing manifest each exited 1 with the reason, naming the newest date.
- A missing or unreadable identity, an unknown argument and the wrong key each
  exited 1. SIGINT exited 130 and SIGTERM 143. No drill container or volume
  remained after any run.
- `shellcheck` 0.11.0 reports nothing for the drill.

The README drift above is fixed: the project structure points to
`apps/backup/` and `infra/aws/`, the SonarQube section names `infra/aws/`, and
"Dependency updates" counts three Dockerfiles and mentions the `postgres`
major ignore. The drill's usage lives in the new `apps/backup/README.md`,
because the root README is on the file-size baseline.

Left for the owner: run the drill against the newest S3 backup with the real
identity file, then record the date and backup key under the spec's Comments.

### 2026-10-22: First drill against S3, and closed as done

The owner ran the drill against the newest S3 backup with the real identity
and it passed: 10 tables match `daily/2026-10-22/`, dumped at
`2026-10-21T20:04:01.622866Z`. The run is recorded under the spec's Comments,
with the next drill due 2027-01-22. The spec is `done`, and
`production-migrations` may start.

All acceptance criteria are met. The drill was built and verified locally in
`cd9dcce`, and the S3 run and this close are recorded in `f2da376`.

### 2026-10-23: Spec reopened

The spec went back to `ready-for-human` until tickets 07 and 03 close; see
its Comments. This ticket stays `done`. Its drill still clears this spec's
part of the `production-migrations` gate, but `production-migrations` also
waits on `../../backlog/issues/03-recover-production-from-a-backup.md`.
