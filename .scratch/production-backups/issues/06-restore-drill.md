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
- [ ] Against S3, refuses before restoring when the chosen backup's dump or manifest has more than one object version, naming the key: a leaked uploader key can add a newer version, encrypted to the public `AGE_RECIPIENT`, that the drill would otherwise restore and pass.
- [ ] Verified locally against a `--local-dir` backup from 04: passes unchanged, fails after one restored row or one manifest value is altered.
- [ ] Owner: drill run against the newest S3 backup and passed; date and backup key recorded under this spec's Comments, with the next drill due in three months.
- [ ] Spec status set to `done`, and the `production-migrations` spec unblocked.

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
