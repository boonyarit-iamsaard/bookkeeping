# 02: Write the storage stack template

Read `../spec.md` first (Storage, Uploader).

**What to build:** One CloudFormation template that creates the backup
bucket with versioning, compliance-mode Object Lock, lifecycle and a TLS-only
policy; the write-only uploader user; and the $1 budget. It is ready for the
owner to deploy in 03.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Notes:** The agent writes and lints the template only. It does not deploy
it, create AWS resources, or hold AWS credentials. The missing-backup alert is
added to this template in 05, not here.

- [ ] Template at `infra/aws/backups.yaml`, region-agnostic, with parameters for the owner's alert email and the bucket name.
- [ ] Bucket: Block Public Access on, bucket owner enforced, SSE-S3 default encryption, versioning on, Object Lock in compliance mode with 35-day default retention, and a bucket policy denying requests where `aws:SecureTransport` is false.
- [ ] Lifecycle: `daily/` expires after 35 days, `monthly/` after 365 days, noncurrent versions after 1 day, expired delete markers removed.
- [ ] IAM user `bookkeeping-backup-uploader` with one inline policy allowing only `s3:PutObject` on `daily/*` and `monthly/*`. No access key in the template; the owner creates it in 03.
- [ ] AWS Budgets monthly cost budget of $1, emailing at 80% actual and 100% forecast.
- [ ] Outputs: the bucket name and the uploader user name.
- [ ] Lints clean with `cfn-lint`, run from a pinned container image without adding a dependency to the repository; the command is recorded under Comments.
- [ ] A short `infra/aws/README.md` gives the owner's deploy command (`aws cloudformation deploy` with `--profile bookkeeping-backups`) and the access-key steps for 03.

## Comments
