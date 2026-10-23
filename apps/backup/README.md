# Production backups

The nightly backup job and the owner's restore drill
(`.scratch/production-backups/spec.md`, ADR 0013). This directory is not a
pnpm workspace package. Railway builds the `Dockerfile` and runs the job on a
cron schedule; the storage it uploads to is `infra/aws/backups.yaml`.

- `Dockerfile`: `postgres:18-alpine` pinned by digest, with `age` and the AWS
  CLI; the job's image.
- `backup.sh`: dumps one snapshot and builds its manifest, encrypts both to
  `AGE_RECIPIENT`, and uploads them under `daily/`, or writes them to a
  directory with `--local-dir`. A run started outside 20:00–20:59 UTC was
  triggered by hand and uploads under `manual/<UTC time>/` instead.
- `manifest.sql`: every `public` table's row count and checksum, shared by the
  job and the drill.
- `restore-drill.sh`: restores a backup into a throwaway container and
  compares it with its manifest.

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
