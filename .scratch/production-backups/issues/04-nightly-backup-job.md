# 04: Run the nightly backup job

Read `../spec.md` first (Backup job, Testing Decisions) and
`docs/adr/0010-protected-main-and-gated-deploys.md` (digest pinning,
Dependabot per Dockerfile directory).

**What to build:** A Railway cron service dumps the whole production database
every night at 03:00 Asia/Bangkok with a manifest from the same snapshot,
encrypts both with the owner's `age` public key, and uploads them to S3. The
first nightly backup is in the bucket.

**Blocked by:** 02 to start, 03 to close

**Status:** ready-for-agent

**Notes:** The agent writes and verifies the job locally with `--local-dir`.
The owner creates the Railway service and sets its variables; the agent does
not handle the AWS secret key.

- [ ] `apps/backup/Dockerfile` on `postgres:18-alpine` pinned by tag and index digest, adding `age`, `aws-cli` and `bash`; `apps/backup/railway.json` with the Dockerfile builder, watch pattern `/apps/backup/**`, cron schedule `0 20 * * *` and restart policy `NEVER`.
- [ ] The job exports a `REPEATABLE READ` snapshot, dumps with `pg_dump --format=custom --snapshot`, and builds the manifest (dump time, server version, per-table row count and row checksum in primary-key order) in the same transaction.
- [ ] Both files are encrypted with `AGE_RECIPIENT` and uploaded to `daily/YYYY-MM-DD/`, and on the first of the month also to `monthly/YYYY-MM/`; dates are Asia/Bangkok.
- [ ] Any failure exits non-zero; no plaintext is written outside the container's temporary directory; no secret is logged.
- [ ] `--local-dir <path>` writes the encrypted files to a directory instead of S3.
- [ ] Verified locally: the image built and run with `--local-dir` against a local PostgreSQL 18 database built by `db:migrate` and seeded with a few rows; both files decrypt with a throwaway key; the manifest's counts match the seed.
- [ ] `.github/dependabot.yml` has a `docker` entry for `/apps/backup` with a three-day cooldown, ignoring `postgres` major updates.
- [ ] Owner: Railway service `backup` created from `/apps/backup/railway.json` with the spec's variables and no public networking; one run triggered by hand succeeds.
- [ ] The first scheduled run's objects appear in S3; date recorded under Comments.

## Comments
