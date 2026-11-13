# Runbook: Deploy the storage stack

- **Source:** [#221](https://github.com/boonyarit-iamsaard/bookkeeping/issues/221)
- **Docs checked:** 2026-10-18
- **Estimated time:** 45 minutes for both parts · **Estimated cost:** budget
  monitoring and alerts are free; S3 storage and requests for a few small
  objects are estimated at under $0.01 a month (the spec's estimate, which
  step 10 checks against the bill).

Part 1 of 2. Step numbers run across the parts: steps 1 to 4 are here, and
steps 5 to 10 are in `03b-backup-service-and-uploader-key.md`.

Every identifier below is a placeholder. Substitute the real value on screen;
never write it into this file. The repository is public.

## Prerequisites

- [x] AWS CLI v2. Installed here: `aws-cli/2.38.1`. Current CLI versions send
      a CRC-based checksum on every upload by default
      (`request_checksum_calculation = WHEN_SUPPORTED`), which S3 requires
      for uploads into a bucket with Object Lock retention.
      Source: <https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html>
- [x] The `bookkeeping-backups` SSO profile from ticket 01. It works here
      today and shows the `AdministratorAccess` role in `backups`.
- [x] The owner's alert email, `<OWNER_EMAIL>`.
- Region: `ap-southeast-1`. Stack: `bookkeeping-backups`.

## Decisions

| Fork                                     | Choice                                                                                                                                                                                      | Why                                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bucket name namespace                    | Account regional: the template passes `BucketNamePrefix` (default `bookkeeping-backups`) with `BucketNamespace: account-regional`, and S3 appends `-<BACKUPS_ACCOUNT_ID>-ap-southeast-1-an` | AWS calls this a security best practice: only this account can ever create the name, even after the bucket is deleted. The template was changed for this on 2026-10-18 and still lints clean. |
| Recording the bucket name under Comments | A placeholder, `<BUCKET_NAME>`, with a note on where the real name lives                                                                                                                    | The repository is public, and an account regional name contains the account ID.                                                                                                               |
| First deploy                             | Create a change set with `--no-execute-changeset`, review it, then execute it                                                                                                               | Mistakes get caught before an Object Lock bucket exists, and the bucket can't be undone.                                                                                                      |

## Steps

### 1. Refresh the SSO session

- [x] **Done** (tick once Verify passes)
- **Goal:** Your terminal holds a fresh `bookkeeping-backups` session.
- **Why:** The permission set's sessions last one hour, and steps 2 to 8
  need one.
- **Where:** This machine's terminal.
- **Do:**
  1. Run `aws sso login --sso-session bookkeeping` and approve it in the
     browser.
- **Expect:** `Successfully logged into Start URL: …`.
- **Verify:** I run
  `aws sts get-caller-identity --profile bookkeeping-backups`. The `Arn`
  must contain `AWSReservedSSO_AdministratorAccess`, and the account must be
  `backups`.
- **Undo:** Not needed.
- **Ticks:** Nothing directly.
- **Source:** <https://docs.aws.amazon.com/cli/latest/userguide/sso-configure-profile-token.html>

### 2. Create the change set and review it

- [x] **Done**
- **Goal:** A change set for a new `bookkeeping-backups` stack exists, and
  it adds exactly four resources.
- **Why:** Your choice: review before anything permanent is created.
  `--no-execute-changeset` creates the change set and exits without applying
  it.
- **Where:** This machine's terminal, from the repository root.
- **Do:**
  1. Run:

     ```sh
     aws cloudformation deploy \
       --profile bookkeeping-backups \
       --region ap-southeast-1 \
       --stack-name bookkeeping-backups \
       --template-file infra/aws/backups.yaml \
       --capabilities CAPABILITY_NAMED_IAM \
       --parameter-overrides AlertEmail=<OWNER_EMAIL> \
       --no-execute-changeset
     ```

  2. Tell me it finished. The command prints a `describe-change-set` command
     containing `<CHANGE_SET_ARN>`; keep that ARN for step 3.
- **Expect:** `Changeset created successfully.`
- **Verify:** I run, read-only:

  ```sh
  aws cloudformation describe-change-set --profile bookkeeping-backups \
    --region ap-southeast-1 --change-set-name <CHANGE_SET_ARN> \
    --query '{Status:Status,Exec:ExecutionStatus,Changes:Changes[].ResourceChange.{Action:Action,Type:ResourceType,Id:LogicalResourceId}}'
  ```

  `Status` must be `CREATE_COMPLETE` and `Exec` must be `AVAILABLE`. There
  must be eleven `Add` changes, one per resource in `infra/aws/backups.yaml`:
  `BackupBucket` (`AWS::S3::Bucket`), `BackupBucketPolicy`, `UploaderUser`
  (`AWS::IAM::User`), `MonthlyCostBudget` (`AWS::Budgets::Budget`),
  `AlertTopic`, `AlertLogGroup`, `AlertRole`, `AlertFunction`,
  `AlertErrorsAlarm`, `AlertSchedulerRole` and `AlertSchedule`. I also check the `AlertEmail`
  parameter against what you meant to type, by showing you its domain only.

- **Undo:** Before step 3, the change set is free to discard:
  `aws cloudformation delete-stack --profile bookkeeping-backups --region ap-southeast-1 --stack-name bookkeeping-backups`
  removes the empty stack that is waiting for review.
- **Ticks:** Nothing yet.
- **Source:** <https://docs.aws.amazon.com/cli/latest/reference/cloudformation/deploy.html>

### 3. Execute the change set ⚠️ Irreversible

- [x] **Done**
- **Goal:** The stack reaches `CREATE_COMPLETE`, with the bucket, its policy,
  the uploader user, the budget and the backup alert.
- **Why:** This creates the storage that ticket 04 writes to.
- **Where:** This machine's terminal.
- **⚠️ What cannot be undone:** Once the bucket exists, Object Lock can't be
  turned off and versioning can't be suspended. The bucket keeps its name
  for good. From step 7 onward it holds a version that compliance mode keeps
  for 35 days. Nobody can delete that version early, root included; AWS's
  only way out is closing the account. The template sets
  `DeletionPolicy: Retain`, so deleting the stack leaves the bucket in place.
- **Do:**
  1. Run:

     ```sh
     aws cloudformation execute-change-set --profile bookkeeping-backups \
       --region ap-southeast-1 --change-set-name <CHANGE_SET_ARN>
     aws cloudformation wait stack-create-complete --profile bookkeeping-backups \
       --region ap-southeast-1 --stack-name bookkeeping-backups
     ```

  2. Tell me when the prompt returns. The wait polls every 30 seconds, and
     exits with code 255 on failure.
- **Expect:** Both commands print nothing and exit 0.
- **Verify:** I run these read-only checks:

  ```sh
  P=(--profile bookkeeping-backups --region ap-southeast-1)
  B=$(aws cloudformation describe-stacks "${P[@]}" --stack-name bookkeeping-backups \
    --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)
  aws cloudformation describe-stacks "${P[@]}" --stack-name bookkeeping-backups \
    --query 'Stacks[0].{Status:StackStatus,Outputs:Outputs}'
  aws s3api get-bucket-versioning "${P[@]}" --bucket "$B"
  aws s3api get-object-lock-configuration "${P[@]}" --bucket "$B"
  aws s3api get-public-access-block "${P[@]}" --bucket "$B"
  aws s3api get-bucket-ownership-controls "${P[@]}" --bucket "$B"
  aws s3api get-bucket-encryption "${P[@]}" --bucket "$B"
  aws s3api get-bucket-lifecycle-configuration "${P[@]}" --bucket "$B"
  aws s3api get-bucket-policy "${P[@]}" --bucket "$B"
  aws iam get-user-policy "${P[@]}" --user-name bookkeeping-backup-uploader \
    --policy-name put-backups
  ```

  Each result must match `infra/aws/backups.yaml`: `CREATE_COMPLETE`; the
  bucket name ends in `-ap-southeast-1-an`; versioning `Enabled`; Object
  Lock `COMPLIANCE` with 35 days; all four public access blocks `true`;
  `BucketOwnerEnforced`; `AES256`; four lifecycle rules; the TLS deny
  statement; and `s3:PutObject` only on `daily/*`, `monthly/*` and
  `manual/*`. I then
  record the outputs under the issue's Comments: the uploader user name
  verbatim, and the bucket name as `<BUCKET_NAME>`.

- **Undo:** If the create fails, the stack rolls back to `ROLLBACK_COMPLETE`.
  I read the failure reason with
  `aws cloudformation describe-stack-events` (read-only). You then delete the
  stack and start again from step 2. A bucket that was created but is still
  empty can be deleted (`aws s3api delete-bucket`), and an account regional
  name stays reserved for this account.
- **Ticks:** "Stack deployed to `ap-southeast-1` in `backups`; the outputs
  are recorded under Comments."
- **Source:** <https://docs.aws.amazon.com/cli/latest/reference/cloudformation/execute-change-set.html>,
  <https://docs.aws.amazon.com/cli/latest/reference/cloudformation/wait/stack-create-complete.html>,
  <https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-managing.html>,
  <https://docs.aws.amazon.com/AmazonS3/latest/userguide/gpbucketnamespaces.html>,
  <https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/troubleshooting.html>

### 4. Confirm the budget's email subscription

- [x] **Done**
- **Goal:** Both budget notifications email `<OWNER_EMAIL>`.
- **Why:** The budget is the cost guardrail behind user story 9.
- **Where:** I check from the terminal. There's nothing for you to do unless
  a confirmation email arrives.
- **Do:**
  1. If an email asks you to confirm a subscription, confirm it and tell me.
     A budget that emails you directly needs no confirmation, but the
     `bookkeeping-backup-alert` SNS topic sends one; confirm that email.
- **Expect:** One SNS confirmation email, confirmed.
- **Verify:** I run, read-only, for both notifications (`ACTUAL` at 80 and
  `FORECASTED` at 100):

  ```sh
  aws budgets describe-subscribers-for-notification "${P[@]}" \
    --account-id <BACKUPS_ACCOUNT_ID> --budget-name bookkeeping-backups-monthly \
    --notification NotificationType=ACTUAL,ComparisonOperator=GREATER_THAN,Threshold=80,ThresholdType=PERCENTAGE
  aws budgets describe-subscribers-for-notification "${P[@]}" \
    --account-id <BACKUPS_ACCOUNT_ID> --budget-name bookkeeping-backups-monthly \
    --notification NotificationType=FORECASTED,ComparisonOperator=GREATER_THAN,Threshold=100,ThresholdType=PERCENTAGE
  aws sns list-subscriptions "${P[@]}"
  ```

  Each notification has one `EMAIL` subscriber, `<OWNER_EMAIL>`. SNS lists
  one `email` subscription on `bookkeeping-backup-alert`, and its
  `SubscriptionArn` is an ARN, not `PendingConfirmation`.

- **Undo:** Update the stack with a different `AlertEmail`.
- **Ticks:** "Budget email confirmed received or subscribed." Note under
  Comments: AWS needs about five weeks of usage before a forecast alert can
  fire, so the 100% forecast alert can't trigger before late November.
- **Source:** <https://docs.aws.amazon.com/cli/latest/reference/budgets/describe-subscribers-for-notification.html>,
  <https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html>,
  <https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-sns-policy.html>

## Run log

### 2026-10-18

- Completed: runbook written. Live state read first: no stack, no bucket, no
  `bookkeeping-backup-uploader` user and no budget in `backups`. The SSO
  profile works, and Budgets is readable from it, so billing access is on in
  the member account. Railway production has `api`, `database` and `web`, and
  no `backup` service.
- Change before deploy: `infra/aws/backups.yaml` now names the bucket in the
  account regional namespace (`BucketNamePrefix` +
  `BucketNamespace: account-regional`), replacing the `BucketName`
  parameter. It lints clean with the pinned `cfn-lint` 1.57.2, and
  `validate-template` accepts it. `infra/aws/README.md` is updated to match.
- Open point from the research: the Budgets docs mention confirming subscriptions only for SNS topics,
  and never say directly whether a direct email subscriber needs one
  (step 4).
- Completed: steps 1 and 2. The change set is `CREATE_COMPLETE` and
  `AVAILABLE`, with four `Add` changes (bucket, bucket policy, uploader user,
  budget). Its parameters are the owner's alert email and the default
  `BucketNamePrefix`, and it carries `CAPABILITY_NAMED_IAM`. Deviation: the
  `describe-change-set` command that `deploy` prints has no `--profile` or
  `--region`; it works only with both added, as in step 2's Verify.
- Completed: step 3. Stack `CREATE_COMPLETE` in `ap-southeast-1`. The bucket
  name has the account regional suffix and its location is
  `ap-southeast-1`; versioning `Enabled`; Object Lock `COMPLIANCE`, 35 days;
  all four public access blocks on; `BucketOwnerEnforced`; `AES256`; the
  three lifecycle rules; the TLS-only deny policy; the uploader's inline
  policy allows only `s3:PutObject` on `daily/*` and `monthly/*`; the budget
  is a $1 monthly cost budget.
- Deviation (runbook bug, not docs): step 3's Verify used `$B` without
  setting it, so the owner's run of it failed with `Invalid bucket name ""`.
  The block now sets `B` from the stack output first.
- Completed: step 4. Both notifications (`ACTUAL` 80%, `FORECASTED` 100%)
  are in state `OK`, each with one `EMAIL` subscriber, the owner's address.
  SNS lists no subscriptions, so nothing awaits confirmation.
- The owner reran the corrected step 3 block and it passed. Its encryption
  output also shows `BlockedEncryptionTypes: SSE-C`, which the template
  doesn't set; it appears to be AWS's default for new buckets. Nothing here
  uses customer-provided keys, so it changes nothing.
