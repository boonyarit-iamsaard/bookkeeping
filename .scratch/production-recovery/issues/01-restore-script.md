# 01: Restore a named backup into a new database

Read `../spec.md` first (`restore.sh`, Testing Decisions).

**What to build:** A `restore.sh` in `apps/backup/` restores a named backup
into a new database at a URL the owner gives it and proves it matches the
backup's manifest, sharing the drill's code.

**Blocked by:** None

**Status:** ready-for-agent

**Notes:** The agent writes and verifies the script locally with
`--local-dir` backups and a stubbed `aws`. Only the owner runs it against S3.

- [ ] The drill's fetch, version check, decrypt and manifest comparison move into `common.sh`; `restore-drill.sh` uses them and still passes its existing checks.
- [ ] `restore.sh` takes `--identity`, and `--backup <prefix>` (any `daily/`, `monthly/` or `manual/` backup) or `--local-dir`; without either, it prints the newest `daily/` prefix as a suggestion and exits.
- [ ] Refuses a backup whose dump or manifest has more than one S3 version, or whose date is after today in Bangkok.
- [ ] Reads the target database URL at a hidden prompt or from the environment, never as an argument.
- [ ] Refuses a target database that already exists; otherwise creates it, restores with `pg_restore --exit-on-error`, rebuilds the manifest with `manifest.sql`, and compares every table.
- [ ] `--check` compares an existing database with a named backup's manifest without restoring.
- [ ] `pg_restore` and `psql` run from the Dockerfile's pinned image; no decrypted file is written to disk.
- [ ] Exits non-zero, naming each differing table, on any mismatch.
- [ ] Verified locally: passes unchanged; fails after one manifest value or one restored row changes; refuses an existing target; with a stubbed `aws`, refuses a second version, a delete marker and a future date; `--check` passes and fails as expected. `shellcheck` reports nothing.
- [ ] `apps/backup/README.md` documents `restore.sh`.

## Comments
