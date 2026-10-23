# 02: Write the storage stack template

Read `../spec.md` first (Storage, Uploader).

**What to build:** One CloudFormation template that creates the backup
bucket with versioning, compliance-mode Object Lock, lifecycle and a TLS-only
policy; the write-only uploader user; and the $1 budget. It is ready for the
owner to deploy in 03.

**Blocked by:** None (can start immediately)

**Status:** done

**Notes:** The agent writes and lints the template only. It does not deploy
it, create AWS resources, or hold AWS credentials. The missing-backup alert is
added to this template in 05, not here.

- [x] Template at `infra/aws/backups.yaml`, region-agnostic, with parameters for the owner's alert email and the bucket name.
- [x] Bucket: Block Public Access on, bucket owner enforced, SSE-S3 default encryption, versioning on, Object Lock in compliance mode with 35-day default retention, and a bucket policy denying requests where `aws:SecureTransport` is false.
- [x] Lifecycle: `daily/` expires after 35 days, `monthly/` after 365 days, noncurrent versions after 1 day, expired delete markers removed.
- [x] IAM user `bookkeeping-backup-uploader` with one inline policy allowing only `s3:PutObject` on `daily/*` and `monthly/*`. No access key in the template; the owner creates it in 03.
- [x] AWS Budgets monthly cost budget of $1, emailing at 80% actual and 100% forecast.
- [x] Outputs: the bucket name and the uploader user name.
- [x] Lints clean with `cfn-lint`, run from a pinned container image without adding a dependency to the repository; the command is recorded under Comments.
- [x] A short `infra/aws/README.md` gives the owner's deploy command (`aws cloudformation deploy` with `--profile bookkeeping-backups`) and the access-key steps for 03.

## Comments

### 2026-10-18: Lint command

`cfn-lint` has no official container image, so it runs from the
`python:3.13-alpine` image pinned by index digest, installing a pinned
`cfn-lint` inside the throwaway container. From the repository root:

```sh
docker run --rm -v "$PWD/infra/aws:/templates:ro" \
  python:3.13-alpine@sha256:2d9aefe2fef018a7eb2c13064c89c71929800fd2e5dccdbf52ea5da5bb8d929a \
  sh -c 'pip install --quiet --root-user-action=ignore cfn-lint==1.57.2 && cfn-lint /templates/backups.yaml'
```

It reports nothing, including with `--include-checks I`. A deliberately
misspelt property fails with E3002, so the run does check the template.

### 2026-10-18: Closed

Done in 9c749bf, merged as ab86a12 (#31). All eight criteria pass: the
template lints clean and the README gives the deploy command and the
access-key steps. A two-axis review found nothing wrong in the template. It
did catch that the README sent the key to a Railway service that ticket 04
creates, so the README now has the owner create that service empty first. It also gives the uploader checks for
ticket 03, with the key kept in the shell only. Ticket 04 should confirm that
Alpine's `aws-cli` sends an upload checksum, because S3 rejects uploads
without one to a bucket with Object Lock retention.
