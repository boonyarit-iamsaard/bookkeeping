# 01: Restore a named backup into a new database

Read `../spec.md` first (`restore.sh`, Testing Decisions).

**What to build:** A `restore.sh` in `apps/backup/` restores a named backup
into a new database at a URL the owner gives it and proves it matches the
backup's manifest, sharing the drill's code.

**Blocked by:** None

**Status:** done

**Notes:** The agent writes and verifies the script locally with
`--local-dir` backups and a stubbed `aws`. Only the owner runs it against S3.

- [x] The drill's fetch, version check, decrypt and manifest comparison move into `common.sh`; `restore-drill.sh` uses them and still passes its existing checks.
- [x] `restore.sh` takes `--identity`, and `--backup <prefix>` (any `daily/`, `monthly/` or `manual/` backup) or `--local-dir`; without either, it prints the newest `daily/` prefix as a suggestion and exits.
- [x] Refuses a backup whose dump or manifest has more than one S3 version, or whose date is after today in Bangkok.
- [x] Reads the target database URL at a hidden prompt or from the environment, never as an argument.
- [x] Refuses a target database that already exists; otherwise creates it, restores with `pg_restore --exit-on-error`, rebuilds the manifest with `manifest.sql`, and compares every table.
- [x] `--check` compares an existing database with a named backup's manifest without restoring.
- [x] `pg_restore` and `psql` run from the Dockerfile's pinned image; no decrypted file is written to disk.
- [x] Exits non-zero, naming each differing table, on any mismatch.
- [x] Verified locally: passes unchanged; fails after one manifest value or one restored row changes; refuses an existing target; with a stubbed `aws`, refuses a second version, a delete marker and a future date; `--check` passes and fails as expected. `shellcheck` reports nothing.
- [x] `apps/backup/README.md` documents `restore.sh`.

## Comments

### 2026-10-23: Built, verified locally, and closed as done

`common.sh` now holds the steps both restores share: the pinned image,
`aws_cli`, the bucket lookup, the newest `daily/` prefix, `fetch_backup` (the
prefix check, the date check against Bangkok and the version check),
`copy_local_backup`, decryption, and `check_manifest`. `fetch_backup` takes a
`daily/`, `monthly/` or `manual/` prefix. It compares a `monthly/` prefix by
month and a `manual/` one by its UTC date, which is never ahead of Bangkok's.
The drill uses these steps and is otherwise unchanged. Mismatch lines now read
"expected …, found …" in both scripts.

`restore.sh` reads the target from `TARGET_DATABASE_URL` or a hidden prompt.
It refuses a URL whose database name isn't letters, digits and underscores,
and it refuses `postgres`. It creates the target through the server's
`postgres` database at the same URL. `psql` and `pg_restore` run from the
pinned image with `docker run --rm --network host`, so they reach a server on
localhost or a public proxy alike. The URL reaches the container through its
environment, not docker's arguments. A failed restore leaves the new database
for the owner to drop. Without `--backup` or `--local-dir`, the script prints
the newest `daily/` prefix on stdout and exits 1.

Checks, with the job image built from this branch, a throwaway `age` key, a
PostgreSQL 18 source database migrated by `db:migrate` and seeded with a user
and a verification, and a second PostgreSQL 18 container as the target:

- The unchanged `--local-dir` backup restored into `railway_restored`: 10
  tables match. The drill passed on the same backup.
- A second run into `railway_restored` was refused because the database
  exists.
- With the `users` row count changed from 1 to 2 in the manifest and
  re-encrypted, the restore exited 1 and named `users`.
- For one changed restored row, a verification was updated and a second
  backup taken; its dump with the first manifest exited 1 and named
  `verifications`. The drill fails the same way.
- `--check` passed on `railway_restored`. After one `users` row was edited
  there, it exited 1 and named `users`.
- With a stubbed `aws`:
  - one version of each file restored `daily/` and the current `monthly/`;
  - two dump versions, two manifest versions, a delete marker and a missing
    dump were each refused;
  - future `daily/`, `monthly/` and `manual/` dates were refused, and today's
    `manual/` UTC stamp passed the date check;
  - a `weekly/` prefix was refused;
  - a failed bucket lookup exited 1 with "run aws sso login first";
  - the suggestion printed the newest `daily/` prefix;
  - `--check` against an S3 backup passed;
  - the drill passed against the stub.
- Through a pty, the hidden prompt accepted the URL without echoing it.
- With no env and no terminal, the script exited 1.
- A bad URL, `postgres` as the target, `--backup` with `--local-dir`, a
  missing identity, the wrong key, an unknown argument and an unreachable
  server each exited 1 with the reason. SIGTERM exited 143. No container
  remained after any run.
- `shellcheck` 0.11.0 reports nothing for the four scripts.

Built in `51e732f`.
