# 06: Prove a backup restores

Read `../spec.md` first (Restore drill, Testing Decisions).

**What to build:** A drill script on the owner's machine restores the newest
nightly backup into a throwaway PostgreSQL 18 container and proves it matches
its manifest. The first passing drill closes this spec.

**Blocked by:** 04

**Status:** ready-for-agent

**Notes:** The agent writes and verifies the script against local backups
from 04's `--local-dir`. Only the owner runs it against S3, because only the
owner holds the private key and the read access.

- [ ] Script in `apps/backup/` taking the newest `daily/` backup from S3 with `--profile bookkeeping-backups`, or a directory with `--local-dir`, plus the path to the `age` identity file.
- [ ] Restores with `pg_restore` into a throwaway `postgres:18-alpine` container pinned by digest, recomputes the manifest exactly as the job does, and compares every table's row count and checksum.
- [ ] Exits non-zero and names the differing tables on any mismatch; removes the container and the plaintext files whether it passes or fails.
- [ ] Verified locally against a `--local-dir` backup from 04: passes unchanged, fails after one restored row or one manifest value is altered.
- [ ] Owner: drill run against the newest S3 backup and passed; date and backup key recorded under this spec's Comments, with the next drill due in three months.
- [ ] Spec status set to `done`, and the `production-migrations` spec unblocked.

## Comments
