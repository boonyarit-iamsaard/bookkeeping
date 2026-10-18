# Production backups off Railway

Status: ready-for-agent

Decided on 2026-10-17 by grilling. Decision recorded in
`docs/adr/0013-nightly-encrypted-backups-to-aws-s3.md`. Read it, ADR 0008 and
ADR 0010 first. This is the first half of milestone one's real-data
readiness; applying migrations to production is a separate, later spec.

## Problem Statement

The production database on Railway has held the owner's real ledger since
2026-09-27, and nothing protects it outside Railway. ADR 0008 requires backups
stored off the hosting provider, because a backup kept with Railway does not
survive losing that account, and Railway deletes a volume's own backups when
the volume is wiped. ADR 0009's answer to a bad migration is "restore from a
backup", so production migrations wait until a restore has been proven.

On 2026-10-17 the database was PostgreSQL 18.6, 8.7 MB, holding 1 user,
7 wallets, 57 categories, 39 transactions and 4 transaction changes. A manual,
`age`-encrypted dump was taken that day as a stopgap.

## Solution

A Railway cron service in the production project dumps the whole database
every night at 03:00 Asia/Bangkok, encrypts the dump and a manifest with the
owner's `age` public key, and uploads both to an S3 bucket in a dedicated AWS
account. The bucket keeps every object for at least 35 days under Object Lock,
and lifecycle rules keep nightly copies for 35 days and monthly copies for
12 months. An AWS-side check emails the owner when no backup has arrived for
26 hours. A restore drill on the owner's machine proves a backup restores
completely, once to close this spec and then every quarter. Railway's own
volume backups stay on as a faster first layer for everyday mistakes.

![Production backup architecture](diagrams/architecture.light.png#gh-light-mode-only)
![Production backup architecture](diagrams/architecture.dark.png#gh-dark-mode-only)

## User Stories

1. As the owner, I want a copy of my ledger outside Railway every night, so that losing the Railway account loses at most one day of entries.
2. As the owner, I want backups only I can decrypt, so that neither Railway nor AWS, nor anyone holding a leaked key, can read my finances.
3. As the owner, I want backups nobody can delete or overwrite for 35 days, not even me, so that a leaked key or a mistake cannot destroy recent copies.
4. As the owner, I want a monthly copy kept for a year, so that I can recover from a mistake I notice weeks later.
5. As the owner, I want an email when a night's backup is missing, so that a silently broken job is noticed within a day.
6. As the owner, I want a drill that restores a backup and proves it matches what was dumped, so that I trust the backups before I need them.
7. As the owner, I want the drill to need no access to production, so that proving a backup never risks the live ledger.
8. As the owner, I want the database to stay on Railway's private network, so that backups do not require exposing it to the internet.
9. As the owner, I want the AWS side to cost well under a dollar a month and to alert me past $1, so that it stays inside the $10 budget.
10. As the owner, I want the AWS resources written as one CloudFormation template I deploy by hand, so that they are reviewable and CI never holds AWS credentials.
11. As the owner, I want the backups in their own AWS account, so that my SAA-C03 practice can never touch them.

## Implementation Decisions

### AWS accounts and access

- The owner's existing AWS account becomes the management account of an AWS
  Organization. A member account, `backups`, is created inside it with a
  plus-addressed root email in the owner's usual inbox. Practice work goes
  into a separate `sandbox` member account, never the management account.
- IAM Identity Center provides one owner user with MFA, with access to
  `backups`. Root sign-in for member accounts is removed through
  Organizations' centralized root access management where available. The
  management account's root keeps MFA and is not used day to day.
- Only the owner's Identity Center session can read backups. No read-capable
  access key exists anywhere.

### Storage (CloudFormation, `ap-southeast-1`)

- One S3 bucket with Block Public Access on, Object Ownership set to bucket
  owner enforced, default SSE-S3 encryption, and a bucket policy that denies
  requests without TLS.
- Versioning on, and Object Lock in **compliance** mode with a default
  retention of 35 days. Nobody, including root, can delete or overwrite an
  object version inside its retention.
- Object keys:
  - `daily/YYYY-MM-DD/bookkeeping.dump.age` and
    `daily/YYYY-MM-DD/manifest.json.age`, written every night.
  - `monthly/YYYY-MM/bookkeeping.dump.age` and
    `monthly/YYYY-MM/manifest.json.age`, also written on the first night of
    each month.
- Lifecycle: objects under `daily/` expire after 35 days and objects under
  `monthly/` after 365 days; noncurrent versions expire one day after becoming
  noncurrent, and expired delete markers are removed. Expiry can only take
  effect once the Object Lock retention has passed.
- An AWS Budgets monthly cost budget of $1 for the `backups` account, emailing
  the owner on 80% actual and 100% forecast.
- None of these: NAT Gateway, Secrets Manager, customer-managed KMS keys, or
  anything running inside a VPC.

### Uploader

- One IAM user, `bookkeeping-backup-uploader`, whose only permission is
  `s3:PutObject` on `daily/*` and `monthly/*` in the bucket. It cannot list,
  read, delete, change retention, or bypass governance. Its access key is the
  only long-lived AWS secret, stored only in the Railway service's variables.
- The key is replaced every year, and immediately on any suspected exposure:
  create the new key, update the Railway variables, confirm the next nightly
  upload, then delete the old key. The next due date is recorded under
  Comments when the key is created.

### Backup job

- Lives in `apps/backup/`: a Dockerfile, a `railway.json`, and the job script.
  It is not a pnpm workspace package. The base image is `postgres:18-alpine`
  pinned by tag and index digest (ADR 0010), with `age`, the AWS CLI and
  `bash` added from Alpine packages.
- Railway runs it as a cron service named `backup` in the production project:
  schedule `0 20 * * *` (UTC, which is 03:00 Asia/Bangkok), restart policy
  `NEVER`, no public networking. It watches only `/apps/backup/**`.
- Variables: `DATABASE_URL` referencing the Postgres service's private URL,
  `AGE_RECIPIENT` (the owner's public key), `BACKUP_BUCKET`, `AWS_REGION`,
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
- One run:
  1. Open a `REPEATABLE READ` transaction and export its snapshot with
     `pg_export_snapshot()`.
  2. `pg_dump --format=custom --snapshot=<id>` the whole database: ledger,
     auth tables and creation receipts.
  3. In the same transaction, build the manifest: dump time, PostgreSQL
     version, and for every table in `public` its row count and a checksum of
     its rows in primary-key order.
  4. Encrypt both with `AGE_RECIPIENT` and upload them under `daily/`, and on
     the first of the month also under `monthly/`.
  5. Exit non-zero on any failure, so Railway marks the run failed. Plaintext
     never touches disk outside the container's temporary directory.
- A `--local-dir <path>` mode writes the two encrypted files to a directory
  instead of S3, for verification without AWS.
- Dependabot gets a `docker` entry for `/apps/backup`, ignoring `postgres`
  major updates, because its fetcher does not recurse.

### Missing-backup alert

- Added to the same template: an EventBridge Scheduler schedule at 09:00
  Asia/Bangkok invokes a small Lambda (inline Python) that finds the newest
  object under `daily/` and publishes to an SNS topic when it is older than
  26 hours. Its role may only list the `daily/` prefix and publish to that topic.
- A CloudWatch alarm on the Lambda's errors publishes to the same topic, so a
  broken checker is noticed too.
- The topic has one email subscription, the owner's, confirmed by the owner.

### Restore drill

- A script in `apps/backup/` run on the owner's machine with Docker, `age`
  and the AWS CLI. It takes the newest `daily/` backup from S3 (through
  `aws sso login`), or a local directory from `--local-dir`.
- It decrypts both files with the owner's private key, restores the dump with
  `pg_restore` into a throwaway `postgres:18-alpine` container, recomputes the
  manifest from the restored database, and compares. It exits non-zero on any
  difference, then removes the container and the plaintext files.
- The drill passes when every table's row count and checksum match. Each run
  is recorded under this spec's Comments with its date and the backup it
  restored. It runs once to close this spec, then quarterly.

### Railway's own backups

- On the Postgres service's Backups tab: daily, weekly and monthly schedules
  (kept 6, 27 and 89 days per Railway's documentation). These restore fastest
  but do not satisfy ADR 0008: they live in the same account and are deleted
  with the volume.
- Dropped on 2026-10-18: creating backups and schedules needs Railway's Pro
  plan, and the project stays on Hobby. See ticket 01's Comments.

### Key custody

- The owner's `age` private key is kept in two places the owner controls,
  such as a password manager and an offline copy. Losing it makes every backup
  unreadable. Only the public key goes to Railway.

## Testing Decisions

- The job and the drill are tested end to end, not with unit tests: run the
  job image with `--local-dir` against a local PostgreSQL 18 database built by
  `db:migrate` and seeded with a few rows, then run the drill against that
  directory. The drill must pass, and must fail after one byte of the manifest
  or one restored row is changed.
- The template is checked by deploying it to the `backups` account. The
  bucket's protections are checked by trying, as the uploader, to read, list
  and delete an object, and as the owner, to delete a locked version: all must
  be refused.
- The alert is checked by invoking the Lambda while the newest backup is older
  than 26 hours, or with a shorter threshold set for the test, and receiving
  the email.

## Out of Scope

- Applying migrations to production, including baselining the existing
  database, which has no Drizzle migrations table. That is the next spec,
  `production-migrations`, which starts after this spec's first passing drill.
- Point-in-time recovery or WAL archiving.
- Restoring into Railway automatically, or any one-click restore.
- Exports in a portable format such as CSV.
- Cross-region replication of the bucket.
- Backing up anything other than the database: the images are rebuilt from
  the repository, and Railway variables are recorded by the owner separately.

## Further Notes

- Pricing was estimated, not checked, during the grilling: a compressed dump
  is tens of KB, so a year of copies is a few MB and S3 storage and requests
  are under $0.01 a month. Ticket 03 records the first month's actual cost.
- The `age` key used for the 2026-10-17 manual dump was exposed in a
  screenshot during the grilling. The owner was asked to replace it and
  re-encrypt that dump; the automated job must use the replacement.

## Build log

`build-log.md` collects material for an article about this feature. Closing
any ticket includes adding a dated entry covering what happened, why, how,
and the struggles overcome. The repository is public, so entries hold no
secrets, account IDs or real financial figures.

## Order of tickets

01 (owner) and 02 are independent. 03 (owner) follows both. 04 can be written
after 02 and closes after 03. 05 and 06 follow 04; 06 closes this spec.
