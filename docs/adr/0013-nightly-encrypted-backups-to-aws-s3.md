# Nightly encrypted backups to AWS S3 from inside Railway

The production database has held the owner's real ledger since 2026-09-27,
and ADR 0008 requires backups stored off Railway. Every night a Railway cron
service in the production project dumps the whole database over the private
network, encrypts the dump and a manifest with the owner's `age` public key,
and uploads them with a write-only IAM key to an S3 bucket in a dedicated AWS
account. The bucket holds every object under compliance-mode Object Lock for
35 days, keeps nightly copies 35 days and monthly copies a year, and an
AWS-side check emails the owner when a night is missing. A drill on the
owner's machine restores a backup and checks it against its manifest, once
before production migrations and then quarterly. The design is in
`.scratch/production-backups/spec.md`.

## Considered options

- Cloudflare R2, the direction the deployment spec first recorded: rejected.
  It would work, but the owner is preparing for AWS SAA-C03, and at tens of
  KB a night the AWS cost is effectively zero, so S3 gives the same safety
  plus practice with the services the exam covers.
- Running the job in AWS (EventBridge with Lambda or Fargate) or in GitHub
  Actions: rejected. Both avoid a long-lived AWS key through IAM roles or
  OIDC, but both need the database permanently reachable from the internet,
  guarded only by its password. Inside Railway the database stays private,
  and the one key it needs can only add objects.
- Relying on S3 encryption alone: rejected. Anyone who can read the bucket
  would get plaintext. With `age`, neither Railway, AWS nor a leaked key can
  read a backup; the cost is that losing the private key loses every backup,
  so it is kept in two places.
- Governance-mode Object Lock: rejected. An administrator could bypass it, so
  a compromised owner session could still destroy recent backups. Compliance
  mode cannot be shortened by anyone, at the price of keeping any mistaken
  upload for 35 days.
- Railway's volume backups alone: rejected as the off-provider copy. They stay
  on as a faster first layer, but they live in the same account and are
  deleted with the volume.
- Point-in-time recovery through WAL archiving: rejected. A managed Railway
  database makes it hard, and at about two transactions a day, losing up to a
  day means re-entering a few entries.

## Consequences

- One long-lived secret exists: the uploader's access key in Railway's
  variables. It can only add objects to two prefixes, and it is replaced
  yearly.
- Backups live in their own AWS account under the owner's Organization, so
  practice in other accounts cannot touch them. Only the owner's Identity
  Center session can read them.
- The AWS resources are one CloudFormation template deployed by hand; CI
  never holds AWS credentials.
- Applying migrations to production waits for the first passing restore
  drill, because ADR 0009 relies on backups to undo a bad migration.

## Amendment, 2026-10-23

The uploader key can also add objects under `manual/`. A backup run triggered
by hand writes there, never to `daily/`, because a second version of a
`daily/` key looks like a planted backup and the restore drill refuses it.
`manual/` gets the same Object Lock retention and expires after 35 days. See
`.scratch/production-backups/issues/07-manual-backup-prefix.md`.
