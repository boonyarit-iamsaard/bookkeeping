# AWS backup storage

`backups.yaml` is the CloudFormation stack behind the production backups
(`.scratch/production-backups/spec.md`): the Object Lock bucket, the
write-only uploader user and the $1 monthly budget. The owner deploys it by
hand to the `backups` account; CI never holds AWS credentials (ADR 0013).

## Deploy

Sign in with `aws sso login --profile bookkeeping-backups`, then deploy. The
bucket name must be globally unique, and Object Lock makes it permanent for
the stack's life, so choose it once.

```sh
aws cloudformation deploy \
  --profile bookkeeping-backups \
  --region ap-southeast-1 \
  --stack-name bookkeeping-backups \
  --template-file infra/aws/backups.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides AlertEmail=<owner email> BucketName=<bucket name>
```

`CAPABILITY_NAMED_IAM` is needed because the uploader user has a fixed name.
Read the outputs back with:

```sh
aws cloudformation describe-stacks \
  --profile bookkeeping-backups \
  --region ap-southeast-1 \
  --stack-name bookkeeping-backups \
  --query "Stacks[0].Outputs"
```

The bucket is retained if the stack is deleted, because compliance-mode Object
Lock keeps every version for 35 days regardless.

## Uploader access key

The template creates no access key. Create it once the stack is deployed, and
put the secret straight into Railway, never into a file or a conversation.
Ticket 04 builds the Railway `backup` service; if it does not exist yet,
create it now as an empty service in the production project, so the key has
somewhere to live, and point it at `/apps/backup/railway.json` in 04.

1. In the IAM console of the `backups` account, open **Users**, then
   `bookkeeping-backup-uploader`, then **Security credentials**.
2. Choose **Create access key**, use case **Application running outside AWS**.
3. Copy the access key ID and secret into the `backup` service's
   `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` variables.
4. For ticket 03's checks, paste the same two values into a terminal with
   `read -rs AWS_ACCESS_KEY_ID` and `read -rs AWS_SECRET_ACCESS_KEY`, then
   `export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY`, so they stay out of files
   and shell history. Then close the console page; the secret cannot be shown
   again.
5. Record the key's creation date and its replacement date, one year later,
   under ticket 03's Comments.

In that terminal, run the uploader checks without `--profile`, so the
exported key is used. The first command must succeed and the other three must
be refused:

```sh
echo probe | aws s3 cp - s3://<bucket name>/daily/test/probe.txt --region ap-southeast-1
aws s3 ls s3://<bucket name>/ --region ap-southeast-1
aws s3 cp s3://<bucket name>/daily/test/probe.txt - --region ap-southeast-1
aws s3 rm s3://<bucket name>/daily/test/probe.txt --region ap-southeast-1
```

Run `unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY` when done. The owner's
check, deleting the probe's version, uses `--profile bookkeeping-backups`.

To replace the key: create the new one, update the Railway variables, confirm
the next nightly upload, then delete the old key.

## Lint

`cfn-lint` runs from a digest-pinned Python image, so the repository gains no
dependency:

```sh
docker run --rm -v "$PWD/infra/aws:/templates:ro" \
  python:3.13-alpine@sha256:2d9aefe2fef018a7eb2c13064c89c71929800fd2e5dccdbf52ea5da5bb8d929a \
  sh -c 'pip install --quiet --root-user-action=ignore cfn-lint==1.57.2 && cfn-lint /templates/backups.yaml'
```
