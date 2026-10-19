# Runbook: Deploy the missing-backup alert and prove it fires

- **Source:** `.scratch/production-backups/issues/05-missing-backup-alert.md`
  (owner items: stack updated, SNS subscription confirmed, alert proven)
- **Docs checked:** 2026-10-19. The CloudFormation `deploy` CLI reference page
  returned 404 when fetched, so the `--no-execute-changeset` and
  `--no-fail-on-empty-changeset` flags were checked against the installed CLI's
  own help (`aws cloudformation deploy help`, aws-cli 2.38.1) instead.
  `execute-change-set` is the command runbook 03 used.
- **Estimated time:** 45 minutes, plus waiting for two emails (the SNS
  confirmation and the alert) · **Estimated cost:** under $0.20 a month,
  estimated and not checked against the price pages. The CloudWatch alarm is
  the main charge; SNS email and a once-a-day Lambda are negligible.

Every identifier below is a placeholder. Substitute the real value on screen;
never write it into this file. The repository is public.

## Prerequisites

- [x] AWS CLI v2. Installed here: `aws-cli/2.38.1`.
      Source: <https://docs.aws.amazon.com/cli/latest/userguide/sso-configure-profile-token.html>
- [ ] A fresh `bookkeeping-backups` SSO session. The session had expired when
      the docs were checked, so step 1 renews it.
- [x] The stack `bookkeeping-backups` exists in `ap-southeast-1`, deployed in
      ticket 03.
- [ ] Access to the owner's inbox, `<OWNER_EMAIL>`, for the SNS confirmation
      and the alert email.
- Region: `ap-southeast-1`. Profile: `bookkeeping-backups`. Stack:
  `bookkeeping-backups`. Run every command from the repository root.
  Shell: zsh.

## Decisions

| Fork                   | Choice                                                                                    | Why                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How to prove the alert | Redeploy with `BackupMaxAgeHours=1`, invoke the Lambda once, then restore 26              | The ticket's first option. At the docs check the newest backup was about 4.6 hours old, so a 1-hour threshold alerts now. Waiting for a genuinely stale backup would mean a missed night. |
| Deploy method          | Change set first (`--no-execute-changeset`), review it, then execute. Same as runbook 03. | The stack holds an Object Lock bucket that cannot be replaced, so the change set must show no replacement of the bucket before anything runs.                                             |

## Steps

### 1. Renew the SSO session

- [ ] **Done** (tick once Verify passes)
- **Goal:** Your terminal holds a fresh `bookkeeping-backups` session.
- **Why:** Every later step calls AWS with this profile. The session had
  expired when the docs were checked.
- **Where:** This machine's terminal.
- **Do:**
  1. Run `aws sso login --sso-session bookkeeping` and approve it in the
     browser.
- **Expect:** `Successfully logged into Start URL: …`.
- **Verify:** `aws sts get-caller-identity --profile bookkeeping-backups`
  shows an `Arn` containing `AWSReservedSSO_AdministratorAccess`, in the
  `backups` account.
- **Undo:** Not needed.
- **Ticks:** Nothing directly.
- **Source:** <https://docs.aws.amazon.com/cli/latest/userguide/sso-configure-profile-token.html>

### 2. Read the live stack's parameters and status

- [ ] **Done** (tick once Verify passes)
- **Goal:** You know the stack's current parameter values, so the redeploys
  in steps 3, 7 and 9 keep the same bucket name and email.
- **Why:** `BucketNamePrefix` must match the deployed value. A different
  prefix would replace the Object Lock bucket.
- **Where:** This machine's terminal, read-only.
- **Do:**
  1. Run:

     ```bash
     aws cloudformation describe-stacks --profile bookkeeping-backups \
       --region ap-southeast-1 --stack-name bookkeeping-backups \
       --query "Stacks[0].{Status:StackStatus,Parameters:Parameters}"
     ```

- **Expect:** `Status` is `CREATE_COMPLETE` or `UPDATE_COMPLETE`.
  `Parameters` lists `AlertEmail` and `BucketNamePrefix` with values, and no
  `BackupMaxAgeHours`.
- **Verify:** The `BucketNamePrefix` value is `bookkeeping-backups`, the
  default. If it differs, stop and tell the agent before step 3.
- **Undo:** Not needed; read-only.
- **Ticks:** Nothing directly.
- **Source:** <https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-cli-deploy.html>

### 3. Create the change set for the alert template

- [ ] **Done** (tick once Verify passes)
- **Goal:** A change set exists that adds the alert resources. It is not yet
  executed.
- **Why:** Reviewing the change set before executing it shows whether the
  bucket would be touched.
- **Where:** This machine's terminal, from the repository root.
- **Do:**
  1. Run:

     ```bash
     aws cloudformation deploy --profile bookkeeping-backups \
       --region ap-southeast-1 --stack-name bookkeeping-backups \
       --template-file infra/aws/backups.yaml \
       --capabilities CAPABILITY_NAMED_IAM \
       --parameter-overrides AlertEmail=<OWNER_EMAIL> \
         BucketNamePrefix=bookkeeping-backups \
       --no-execute-changeset --no-fail-on-empty-changeset
     ```

  2. Note the `describe-change-set` command it prints, which contains
     `<CHANGE_SET_ARN>`. Keep that ARN for step 4.
- **Expect:** The command finishes without executing anything. A change set
  is created, and the terminal prints the `describe-change-set` command.
- **Verify:** Step 4's review shows the change set is `CREATE_COMPLETE`.
- **Undo:** Before step 5, the change set can be discarded, and the stack is
  unchanged.
- **Ticks:** Nothing directly.
- **Source:** <https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets-create.html>
  (the CLI's `deploy` flags were checked against `aws cloudformation deploy help`,
  aws-cli 2.38.1, since the reference page returned 404.)
  `CAPABILITY_NAMED_IAM` is needed for the named IAM roles this change adds:
  <https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-iam-template.html>

### 4. Review the change set before executing it

- [ ] **Done** (tick once Verify passes)
- **Goal:** You have read what the change set will do, and it does not
  replace the backup bucket.
- **Why:** The bucket is Object Lock with `DeletionPolicy: Retain`. A
  replacement would leave the old bucket behind and create an empty new one.
- **Where:** This machine's terminal, read-only.
- **Do:**
  1. Run the `describe-change-set` command that step 3 printed, with
     `--change-set-name <CHANGE_SET_ARN>`. Add `--profile bookkeeping-backups`
     and `--region ap-southeast-1`.
  2. Read the `Changes` list. Look for the logical IDs `AlertTopic`,
     `AlertLogGroup`, `AlertRole`, `AlertFunction`, `AlertErrorsAlarm`,
     `AlertSchedulerRole` and `AlertSchedule`, all `Add`.
  3. Check `BackupBucket`, `BackupBucketPolicy` and `UploaderUser`. None may
     appear, or any entry must be `Modify` with no `Replacement: True`.
- **Expect:** Seven `Add` entries for the alert resources. The bucket, its
  policy and the uploader user are absent from the list.
- **Verify:** Any `Replacement: True` on `BackupBucket` or a `Remove` on it
  means stop. Tell the agent before executing.
- **Undo:** Discard the change set; nothing has changed yet.
- **Ticks:** Nothing directly.
- **Source:** <https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets-create.html>
  (review of changes, `CREATE_COMPLETE`)

### 5. Execute the change set

- [ ] **Done** (tick once Verify passes)
- **Goal:** The alert resources exist in the `backups` account.
- **Why:** This applies the reviewed change set.
- **Where:** This machine's terminal.
- **Do:**
  1. Run:

     ```bash
     aws cloudformation execute-change-set --profile bookkeeping-backups \
       --region ap-southeast-1 --change-set-name <CHANGE_SET_ARN>
     ```

- **Expect:** The command returns without output. The stack later reaches
  `UPDATE_COMPLETE`.
- **Verify:**

  ```bash
  aws cloudformation describe-stacks --profile bookkeeping-backups \
    --region ap-southeast-1 --stack-name bookkeeping-backups \
    --query "Stacks[0].StackStatus"
  ```

  returns `"UPDATE_COMPLETE"`.

- **Undo:** The stack can be updated back, but the SNS topic and its
  subscription would be removed. Nothing in the bucket is touched.
- **Ticks:** Ticket 05's "Owner: stack updated" waits for step 6.
- **Source:** <https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets-create.html>
  (the CLI command is the one runbook 03 used.)

### 6. Confirm the SNS subscription

- [ ] **Done** (tick once Verify passes)
- **Goal:** The owner's email is a confirmed subscription on the alert topic.
- **Why:** An unconfirmed email subscription receives no messages, so the
  alert would be silent.
- **Where:** Owner's inbox `<OWNER_EMAIL>`, then the SNS console in the
  `backups` account (per docs, verify on screen).
- **Do:**
  1. Open the email with subject `AWS Notification - Subscription
Confirmation`, sent after step 5, and choose **Confirm subscription**.
  2. In the SNS console, open **Subscriptions** and find the subscription to
     `bookkeeping-backup-alert`.
- **Expect:** The page confirms the subscription, and its status is
  `Confirmed`, not `Pending confirmation`.
- **Verify:** The subscription's status is `Confirmed`.
- **Undo:** Not needed; an unconfirmed subscription can be deleted in the
  console.
- **Ticks:** Ticket 05's "Owner: stack updated, SNS subscription confirmed"
  (after steps 5 and 6).
- **Source:** <https://docs.aws.amazon.com/sns/latest/dg/sns-create-subscribe-endpoint-to-topic.html>

### 7. Set the threshold to 1 hour

- [ ] **Done** (tick once Verify passes)
- **Goal:** The live alert uses a 1-hour threshold, so a stale check fires.
- **Why:** The backup at 20:00 UTC is already more than an hour old, so a
  1-hour check must alert. That proves the path end to end without waiting.
- **Where:** This machine's terminal, from the repository root.
- **Do:**
  1. Repeat step 3 with `BackupMaxAgeHours=1` added to `--parameter-overrides`,
     and `--no-execute-changeset`. Keep the same `AlertEmail` and
     `BucketNamePrefix`.
  2. Review the new change set as in step 4. The only change should be the
     `MAX_AGE_HOURS` environment variable of `AlertFunction`.
  3. Execute it as in step 5.
- **Expect:** The stack reaches `UPDATE_COMPLETE`. `AlertFunction` changes
  only in its environment.
- **Verify:**

  ```bash
  aws lambda get-function-configuration --profile bookkeeping-backups \
    --region ap-southeast-1 --function-name bookkeeping-backup-alert \
    --query "Environment.Variables.MAX_AGE_HOURS"
  ```

  returns `"1"`.

- **Undo:** Step 9 restores 26.
- **Ticks:** Nothing directly.
- **Source:** <https://docs.aws.amazon.com/cli/latest/reference/lambda/get-function-configuration.html>
  and <https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets-create.html>

### 8. Invoke the Lambda once

- [ ] **Done** (tick once Verify passes)
- **Goal:** The checker runs, finds the 20:00 UTC backup older than an hour,
  and emails the owner.
- **Why:** This is the alert's proof. The run is manual; the schedule stays
  as it is.
- **Where:** This machine's terminal.
- **Do:**
  1. Run:

     ```bash
     aws lambda invoke --profile bookkeeping-backups \
       --region ap-southeast-1 --function-name bookkeeping-backup-alert \
       --cli-binary-format raw-in-base64-out --payload '{}' "$(mktemp)"
     ```

     The payload goes to a temporary file, not the repository.

  2. Check the owner's inbox for an email titled
     `Bookkeeping backup is missing`.
- **Expect:** The command prints `"StatusCode": 200`, with no `FunctionError`.
  The email arrives within a few minutes. Its body names the newest
  `daily/` backup and the check time.
- **Verify:** `FunctionError` is absent from the output, and the email
  arrived. If there is no `FunctionError` but no email, check the SNS
  subscription status from step 6.
- **Undo:** Not needed; invoking is read-only apart from the alert.
- **Ticks:** Ticket 05's "the email arrived" (with step 9).
- **Source:** <https://docs.aws.amazon.com/cli/latest/reference/lambda/invoke.html>

### 9. Restore the threshold to 26 hours

- [ ] **Done** (tick once Verify passes)
- **Goal:** The live alert uses the default 26-hour threshold again.
- **Why:** The spec's threshold is 26 hours. A 1-hour alert would email the
  owner every morning.
- **Where:** This machine's terminal, from the repository root.
- **Do:**
  1. Repeat step 3 with `BackupMaxAgeHours=26` in `--parameter-overrides`,
     and `--no-execute-changeset`.
  2. Review the change set as in step 4, then execute it as in step 5.
- **Expect:** The stack reaches `UPDATE_COMPLETE`.
- **Verify:** The `get-function-configuration` command from step 7 returns
  `"26"`.
- **Undo:** Not applicable; this step is the undo of step 7.
- **Ticks:** Ticket 05's "the threshold restored to 26 hours", with the email
  from step 8.
- **Source:** <https://docs.aws.amazon.com/cli/latest/reference/lambda/get-function-configuration.html>

### 10. Check the next morning's run

- [ ] **Done** (tick once you have checked the inbox)
- **Goal:** The scheduled check runs at 09:00 Bangkok and stays quiet while the
  nightly backup is fresh.
- **Why:** The scheduled path is separate from the manual invoke in step 8.
  It has not run yet.
- **Where:** Owner's inbox, the next morning.
- **Do:**
  1. At 09:00 Asia/Bangkok, which is 02:00 UTC, the schedule invokes the
     Lambda. The newest backup, from 20:00 UTC the night before, is about
     6 hours old, within the 26-hour threshold.
  2. Confirm no `Bookkeeping backup is missing` email arrived.
- **Expect:** No alert email. The Scheduler's next run is shown in the
  EventBridge Scheduler console.
- **Verify:** No email, and no `Errors` alarm.
- **Undo:** Not applicable.
- **Ticks:** Nothing directly; this confirms the scheduled path after the
  ticket closes.
- **Source:** <https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html>

## Run log

### 2026-10-19

- Completed: none yet.
- Deviations from docs: the `cloudformation deploy` reference page returned 404
  when fetched. The flags were checked against the installed CLI's own help.
