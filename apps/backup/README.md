# Production backups

The nightly backup job, the owner's restore drill and the restore used for
recovery (`.scratch/production-backups/spec.md`,
`.scratch/production-recovery/spec.md`, ADR 0013). This directory is not a
pnpm workspace package. Railway builds the `Dockerfile` and runs the job on a
cron schedule; the storage it uploads to is `infra/aws/backups.yaml`.

- `Dockerfile`: `postgres:18-alpine` pinned by digest, with `age` and the AWS
  CLI; the job's image.
- `backup.sh`: dumps one snapshot and builds its manifest, encrypts both to
  `AGE_RECIPIENT`, and uploads them under `daily/`, or writes them to a
  directory with `--local-dir`. A run started outside 20:00–20:59 UTC was
  triggered by hand and uploads under `manual/<UTC time>/` instead.
- `common.sh`: the backup's file names and the logging, sourced by the job
  and the restores.
- `restore-common.sh`: the tool checks, fetch, version and date checks,
  decryption and manifest comparison that the drill and the restore share.
  The manifest reaches `psql` on its standard input, never a command line.
  It is not in the job's image.
- `manifest.sql`: every `public` table's row count and checksum, shared by the
  job, the drill and the restore.
- `restore-drill.sh`: restores a backup into a throwaway container and
  compares it with its manifest.
- `restore.sh`: restores a named backup into a new database at a URL the
  owner gives it, and compares it with its manifest.

Before changing the restore scripts, read
`.scratch/backlog/issues/05-port-restore-scripts-to-typescript.md`: a real
change to them reopens the deferred port to TypeScript.

## Restore drill

Run it on the owner's machine with Docker, `age` and the AWS CLI. After
`aws sso login --sso-session bookkeeping`, restore the newest nightly backup:

```bash
apps/backup/restore-drill.sh --identity <path to the age identity file>
```

`--local-dir <path>` restores a directory written by `backup.sh --local-dir`
instead, and `--profile` names another AWS profile than `bookkeeping-backups`.
The drill exits non-zero and names each table that differs. It removes the
container and its volume whether it passes or fails, and no decrypted file is
written to disk.

The uploader key can add objects but not read or delete them, and the
recipient is public, so a leaked key could plant a backup that restores and
matches its own manifest. The drill refuses a backup whose dump or manifest
has more than one S3 version, or whose date is after today in Bangkok.

## Restore

`restore.sh` is the recovery runbook's restore step. It runs on the owner's
machine with the same tools as the drill, and `psql` and `pg_restore` run from
the job's pinned image through Docker, on the host network, so no local
PostgreSQL client is needed. Name the backup; there is no default:

```bash
apps/backup/restore.sh --identity <path to the age identity file> \
  --backup daily/2026-10-22
```

`--backup` takes any `daily/<date>`, `monthly/<month>` or `manual/<UTC time>`
prefix, and `--local-dir <path>` restores a directory written by `backup.sh
--local-dir` instead. Without either, it prints the newest `daily/` prefix as a
suggestion and exits. `--profile` names another AWS profile, as in the drill.

The target URL, such as
`postgresql://postgres:<password>@<proxy host>:<port>/railway_restored?sslmode=require`,
is read from `TARGET_DATABASE_URL` or asked for at a hidden prompt, never
taken as an argument. Its database name is letters, digits and underscores.
The script creates that database through the server's `postgres` database and
refuses one that already exists; it never drops, renames or overwrites
anything. It restores with `pg_restore --exit-on-error`, rebuilds the manifest
with `manifest.sql`, and exits non-zero naming each table that differs. A
failed restore leaves the new database for the owner to inspect and drop.

`--check` compares an existing database at the URL with the named backup's
manifest without restoring, for the check after the swap. The script refuses
the same backups as the drill, and no decrypted file is written to disk.
