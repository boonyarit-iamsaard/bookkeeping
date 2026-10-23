# Runbook: Deploy the storage stack and create the uploader key

- **Source:** `.scratch/production-backups/issues/03-deploy-storage-and-uploader-key.md`
- **Docs checked:** 2026-10-18
- **Estimated time:** 45 minutes, plus one check after the first billing
  period closes · **Estimated cost:** budget monitoring and alerts are free;
  S3 storage and requests for a few small objects are estimated at under
  $0.01 a month (the spec's estimate, which step 10 checks against the bill).
  Railway: nothing, because the empty `backup` service runs no deployment.

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
- [x] Railway CLI 5.70.0, linked to the `bookkeeping` project, `production`
      environment. Used only for read-only checks.
- [x] A browser signed in to the AWS access portal, for the IAM console in
      step 6, and the Railway dashboard, for step 5.
- [x] The owner's alert email, `<OWNER_EMAIL>`.
- Region: `ap-southeast-1`. Stack: `bookkeeping-backups`. Shell: zsh (the
  subshell in step 7 uses zsh's `read` syntax).

## Decisions

| Fork                                        | Choice                                                                                                                                                                                      | Why                                                                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bucket name namespace                       | Account regional: the template passes `BucketNamePrefix` (default `bookkeeping-backups`) with `BucketNamespace: account-regional`, and S3 appends `-<BACKUPS_ACCOUNT_ID>-ap-southeast-1-an` | AWS calls this a security best practice: only this account can ever create the name, even after the bucket is deleted. The template was changed for this on 2026-10-18 and still lints clean. |
| Recording the bucket name under Comments    | A placeholder, `<BUCKET_NAME>`, with a note on where the real name lives                                                                                                                    | The repository is public, and an account regional name contains the account ID.                                                                                                               |
| Where the secret key lives before ticket 04 | An empty Railway service named `backup` in production, with `AWS_SECRET_ACCESS_KEY` sealed                                                                                                  | `infra/aws/README.md` already planned the empty service. Railway never shows a sealed value in the UI, API or CLI.                                                                            |
| First deploy                                | Create a change set with `--no-execute-changeset`, review it, then execute it                                                                                                               | Mistakes get caught before an Object Lock bucket exists, and the bucket can't be undone.                                                                                                      |

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
  must be four `Add` changes: `BackupBucket` (`AWS::S3::Bucket`),
  `BackupBucketPolicy`, `UploaderUser` (`AWS::IAM::User`) and
  `MonthlyCostBudget` (`AWS::Budgets::Budget`). I also check the `AlertEmail`
  parameter against what you meant to type, by showing you its domain only.

- **Undo:** Before step 3, the change set is free to discard:
  `aws cloudformation delete-stack --profile bookkeeping-backups --region ap-southeast-1 --stack-name bookkeeping-backups`
  removes the empty stack that is waiting for review.
- **Ticks:** Nothing yet.
- **Source:** <https://docs.aws.amazon.com/cli/latest/reference/cloudformation/deploy.html>

### 3. Execute the change set ⚠️ Irreversible

- [x] **Done**
- **Goal:** The stack reaches `CREATE_COMPLETE`, with the bucket, its policy,
  the uploader user and the budget.
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
  `BucketOwnerEnforced`; `AES256`; three lifecycle rules; the TLS deny
  statement; and `s3:PutObject` only on `daily/*` and `monthly/*`. I then
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
     For a budget that emails you directly, the docs mention confirmation
     only for SNS topics, so none is expected.
- **Expect:** No action needed.
- **Verify:** I run, read-only, for both notifications (`ACTUAL` at 80 and
  `FORECASTED` at 100):

  ```sh
  aws budgets describe-subscribers-for-notification "${P[@]}" \
    --account-id <BACKUPS_ACCOUNT_ID> --budget-name bookkeeping-backups-monthly \
    --notification NotificationType=ACTUAL,ComparisonOperator=GREATER_THAN,Threshold=80,ThresholdType=PERCENTAGE
  aws sns list-subscriptions "${P[@]}"
  ```

  Each notification has one `EMAIL` subscriber, `<OWNER_EMAIL>`. SNS lists
  no subscription, so nothing is waiting for confirmation.

- **Undo:** Update the stack with a different `AlertEmail`.
- **Ticks:** "Budget email confirmed received or subscribed." Note under
  Comments: AWS needs about five weeks of usage before a forecast alert can
  fire, so the 100% forecast alert can't trigger before late November.
- **Source:** <https://docs.aws.amazon.com/cli/latest/reference/budgets/describe-subscribers-for-notification.html>,
  <https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html>,
  <https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-sns-policy.html>

### 5. Create the empty Railway `backup` service

- [x] **Done**
- **Goal:** The production environment has a service named `backup` with no
  source and no deployment.
- **Why:** The secret key goes straight into this service's variables in
  step 6. Ticket 04 then points the service at `apps/backup/`.
- **Where:** Railway dashboard → project `bookkeeping` → environment
  `production` → **New** (top right of the canvas) → **Empty Service** (per
  docs, verify on screen).
- **Do:** either from the CLI, which is quicker, or from the dashboard.
  1. CLI: `railway add --service backup`, then choose **Empty Service** and
     skip the variable prompt with Esc. The new service becomes this
     directory's linked service; `railway service database` restores the old
     link if you want it back.
  2. Dashboard: create the empty service, then rename it `backup`. The docs
     don't describe renaming; look in the service's **Settings**.
  3. Either way, add no source, domain or variables yet.
- **Expect:** A `backup` service card on the canvas with nothing deployed.
- **Verify:** I run `railway service list`. It lists `api`, `database`, `web`
  and `backup`, and `backup` has no repo, image or URL.
- **Undo:** Delete the service from its **Settings** (per docs, verify on
  screen).
- **Ticks:** Nothing directly; it's needed for step 6.
- **Source:** <https://docs.railway.com/services>,
  <https://docs.railway.com/cli/add>

### 6. Create the access key and store it in Railway

Keep the IAM **Retrieve access key** page open from 6a until step 7 is done.
It is the only place the secret can ever be read.

#### 6a. Create the key

- [x] **Done**
- **Goal:** `bookkeeping-backup-uploader` has one active access key.
- **Why:** The backup job's only long-lived AWS secret.
- **Where:** Access portal → `backups` → `AdministratorAccess` → IAM →
  **Users** → `bookkeeping-backup-uploader` → **Security credentials** tab →
  **Access keys** → **Create access key** (per docs, verify on screen).
- **Do:**
  1. On **Access key best practices & alternatives**, pick the use case. The
     docs say to choose **Other** once you've decided a key is still needed;
     `infra/aws/README.md` names **Application running outside AWS**. Either
     works, so tell me which ones the screen offers.
  2. Optional description tag: `railway backup job`.
  3. Choose **Create access key**. Do **not** choose **Download .csv file**.
- **Expect:** **Retrieve access key** shows the access key ID and a hidden
  secret with **Show**.
- **Verify:** I run
  `aws iam list-access-keys "${P[@]}" --user-name bookkeeping-backup-uploader --query 'AccessKeyMetadata[].{Status:Status,Created:CreateDate}'`.
  It shows one `Active` key. I record its creation date, and a replacement
  date one year later, under Comments. I quote neither the key ID nor the
  secret.
- **Undo:** **Actions** → **Deactivate**, then **Delete**.
- **Ticks:** "Access key created for `bookkeeping-backup-uploader`; its
  creation date and the next replacement date (one year later) recorded under
  Comments."
- **Source:** <https://docs.aws.amazon.com/IAM/latest/UserGuide/access-keys-admin-managed.html>

#### 6b. Put the key into the `backup` service and seal the secret ⚠️ Irreversible

- [x] **Done**
- **Goal:** `backup` has `AWS_ACCESS_KEY_ID` and a sealed
  `AWS_SECRET_ACCESS_KEY`.
- **Why:** The secret must not live in a file or in this conversation.
  Sealing means Railway passes it to deployments but never shows it again.
- **⚠️ What cannot be undone:** A sealed variable can't be unsealed. It can
  still be overwritten with a new value from its 3-dot menu, which is how the
  yearly key replacement works.
- **Where:** Railway dashboard → `backup` → **Variables** → **New Variable**
  (per docs, verify on screen).
- **Do:**
  1. Add `AWS_ACCESS_KEY_ID`, pasting the key ID from the IAM page.
  2. Add `AWS_SECRET_ACCESS_KEY`, using **Show** on the IAM page and copying
     the secret. Use the form, not the Raw Editor.
  3. On `AWS_SECRET_ACCESS_KEY`, open the 3-dot menu and choose **Seal**.
  4. Review the staged changes and choose **Deploy Changes**; the dialog
     offers no apply-only option. With no source, nothing builds.
- **Expect:** Both variables are listed, and the secret shows as sealed.
- **Verify:** I run `railway variable list --service backup --json` and
  show only the key names and whether each value is null. The output holds
  raw values, so I print names only. `AWS_SECRET_ACCESS_KEY` must be null
  (sealed), and `AWS_ACCESS_KEY_ID` present.
- **Undo:** Delete either variable from its 3-dot menu.
- **Ticks:** Part of the access key criterion.
- **Source:** <https://docs.railway.com/variables>

### 7. Prove the uploader can only write

- [x] **Done**
- **Goal:** As the uploader, the probe upload succeeds and list, read and
  delete are refused.
- **Why:** The spec's testing decision: a leaked key can't read or destroy
  backups.
- **Where:** A terminal on this machine. Run it yourself, not through me,
  because it reads the secret.
- **Do:**
  1. Paste this block into zsh. It prompts for the key ID and the secret
     without echoing them. Paste each from the IAM page. The values stay in
     the `( … )` subshell, so they vanish when it exits and never reach
     history or a file.

     ```sh
     B=$(aws cloudformation describe-stacks --profile bookkeeping-backups \
       --region ap-southeast-1 --stack-name bookkeeping-backups \
       --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)
     (
       read -rs 'AWS_ACCESS_KEY_ID?Access key ID: '; echo
       read -rs 'AWS_SECRET_ACCESS_KEY?Secret access key: '; echo
       export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION=ap-southeast-1
       unset AWS_PROFILE
       aws sts get-caller-identity --query Arn --output text | sed 's/::[0-9]*:/::<id>:/'
       echo probe | aws s3 cp - "s3://$B/daily/test/probe.txt"; echo "put exit=$?"
       aws s3 ls "s3://$B/";                                  echo "list exit=$?"
       aws s3 cp "s3://$B/daily/test/probe.txt" -;            echo "get exit=$?"
       aws s3 rm "s3://$B/daily/test/probe.txt";              echo "delete exit=$?"
     )
     ```

  2. Paste the output to me. It holds no secret: the ARN has its account ID
     masked, and the bucket name appears only in error messages, which you
     can trim.
  3. Then close the IAM **Retrieve access key** page.
- **Expect:** The ARN ends in `:user/bookkeeping-backup-uploader`;
  `put exit=0`; list, get and delete each fail with `AccessDenied` or
  `403 Forbidden`, and a non-zero exit.
- **Verify:** The output above. A new key can take a few seconds to work, so
  if the first call fails with `InvalidClientTokenId`, rerun the block. If
  the put fails with a message about `Content-MD5` or `x-amz-checksum`, stop
  and tell me; the checksum default didn't apply.
- **Undo:** The probe can't be deleted for 35 days. Lifecycle expires it then.
- **Ticks:** "As the uploader: uploading `daily/test/probe.txt` succeeds;
  listing the bucket, reading that object, and deleting it are refused."
- **Source:** <https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-managing.html>,
  <https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html>

### 8. Prove even the owner can't delete the locked version

- [x] **Done**
- **Goal:** As the owner, a permanent delete of the probe's version is
  refused.
- **Why:** Compliance mode stops everyone, administrators and root
  included. A delete that names a version ID gets `403 Forbidden`. A delete
  without one only adds a delete marker, which proves nothing, so don't use
  `aws s3 rm` here.
- **Where:** The same terminal as step 7, so `$B` is still set, using the
  SSO profile.
- **Do:**
  1. Run:

     ```sh
     P=(--profile bookkeeping-backups --region ap-southeast-1)
     V=$(aws s3api list-object-versions "${P[@]}" --bucket "$B" \
       --prefix daily/test/probe.txt --query 'Versions[0].VersionId' --output text)
     aws s3api get-object-retention "${P[@]}" --bucket "$B" \
       --key daily/test/probe.txt --version-id "$V"
     aws s3api delete-object "${P[@]}" --bucket "$B" \
       --key daily/test/probe.txt --version-id "$V"; echo "delete exit=$?"
     ```

  2. Paste the output to me.
- **Expect:** The retention shows `"Mode": "COMPLIANCE"` and a
  `RetainUntilDate` 35 days after step 7. The delete fails with
  `AccessDenied` and a non-zero exit.
- **Verify:** I rerun `list-object-versions` (read-only). The probe's
  version is still there, and there are no delete markers.
- **Undo:** Nothing to undo.
- **Ticks:** "As the owner: deleting that object's version is refused because
  of Object Lock."
- **Source:** <https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html>,
  <https://docs.aws.amazon.com/cli/latest/reference/s3api/delete-object.html>,
  <https://docs.aws.amazon.com/cli/latest/reference/s3api/list-object-versions.html>

### 9. Write up the run

- [x] **Done**
- **Goal:** The issue's Comments and the build log record this ticket.
- **Why:** The repository's closing convention (`spec.md`, Build log).
- **Where:** I do this in the repository.
- **Do:** Nothing for you, except reviewing the text.
- **Expect:** Comments with the outputs (bucket name as `<BUCKET_NAME>`),
  the key's dates, the check results, and a note that the probe stays under
  `daily/` until about 35 days after step 7. Ticket 05's check for "newest
  object under `daily/`" will treat the probe as a backup for its first
  26 hours.
- **Verify:** I search the issue, this runbook and the build log for every
  real identifier seen in the conversation, and replace any hit.
- **Undo:** Not needed.
- **Ticks:** Nothing new.
- **Source:** `docs/agents/issue-tracker.md`

### 10. Record the first month's cost (after the billing period closes)

- [ ] **Done**
- **Goal:** The issue records what `backups` cost in October 2026.
- **Why:** The spec estimated, but didn't check, under $0.01 a month.
- **Where:** Access portal → management account → `AdministratorAccess` →
  Billing and Cost Management → **Bills** → **Billing period** (October 2026) → **Charges by account** → `backups` (per docs, verify on screen).
  Wait for the bill status to change from **Pending** to **Issued**, about
  2026-11-03.
- **Do:**
  1. Read the `backups` total and its services.
  2. Tell me the total.
- **Expect:** A few cents at most.
- **Verify:** Your report of the screen. The Cost Explorer API is not used,
  because it charges per request.
- **Undo:** Read-only.
- **Ticks:** "The first month's AWS cost noted under Comments once the
  billing period ends."
- **Source:** <https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/getting-viewing-bill.html>

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
- Open points from the research:
  - The Budgets docs mention confirming subscriptions only for SNS topics,
    and never say directly whether a direct email subscriber needs one
    (step 4).
  - Railway's docs don't describe renaming a service, or what deploying
    staged variables does on a service with no source (steps 5 and 6b).
  - The IAM docs say to choose **Other**, while the README names
    **Application running outside AWS** (step 6a).
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
- Completed: step 5, from the CLI with `railway add --service backup`
  (Empty Service, variable prompt skipped). `railway service list` shows
  `backup` in production, `Offline`, with no repo, image, URL or
  deployment. Its variables are only Railway's own `RAILWAY_*` ones. The
  directory's CLI link moved from `database` to `backup`.
- Completed: step 6a. The use-case page listed CLI, Local code, Application
  running on an AWS compute service, Third-party service, Application
  running outside AWS, and Other; the owner chose **Application running
  outside AWS**. The description tag is `railway backup job`. One key,
  `Active`, created 2026-10-18 10:43 UTC. No .csv was downloaded.
- Completed: step 6b. Both values were pasted with the IAM page's copy
  icons, without **Show**. The secret was sealed before the changes were
  applied. The staged-changes dialog offered only **Deploy Changes**, and
  the service stayed `Offline` with no deployment. The CLI shows
  `AWS_ACCESS_KEY_ID` present (20 characters) and `AWS_SECRET_ACCESS_KEY`
  null, which is how sealed values read back.
- Completed: step 7. As the uploader: `get-caller-identity` shows
  `user/bookkeeping-backup-uploader`; the put exits 0; list fails with
  `AccessDenied` on `s3:ListBucket` (exit 254); get fails with `403` on
  `HeadObject` (exit 1); delete fails with `AccessDenied` on
  `s3:DeleteObject` (exit 1). The owner's `head-object` shows the probe, 6
  bytes, `COMPLIANCE` until 2026-11-22, with a `CRC64NVME` full-object
  checksum. That confirms CLI 2.38.1 sends the checksum Object Lock needs
  without any extra flag. One version, no delete markers.
- Completed: step 8. As the owner (`AdministratorAccess`), retention reads
  `COMPLIANCE` until 2026-11-22. The permanent delete with the version ID
  failed: `AccessDenied ... because object protected by object lock`, exit 254. Afterwards one version remains, with no delete markers.
- Completed: step 9. The issue's Comments record the outputs (bucket as a
  placeholder), the key's dates, the budget, and both sets of checks; the
  build log has a dated entry. Open: step 10, after October's bill is
  issued.
