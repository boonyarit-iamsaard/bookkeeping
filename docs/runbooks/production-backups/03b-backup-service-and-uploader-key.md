# Runbook: Railway backup service and the uploader key

- **Source:** [#221](https://github.com/boonyarit-iamsaard/bookkeeping/issues/221)
- **Docs checked:** 2026-10-18
- **Estimated time:** 45 minutes for both parts, plus one check after the
  first billing period closes · **Estimated cost:** Railway: nothing, because
  the empty `backup` service runs no deployment.

Part 2 of 2. Step numbers run across the parts: steps 1 to 4 are in
`03a-deploy-storage-stack.md`, and steps 5 to 10 are here.

Every identifier below is a placeholder. Substitute the real value on screen;
never write it into this file. The repository is public.

## Prerequisites

- [x] Steps 1 to 4 done: the `bookkeeping-backups` stack is
      `CREATE_COMPLETE`. My checks reuse its profile flags,
      `P=(--profile bookkeeping-backups --region ap-southeast-1)`, as set in
      step 3.
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
- Region: `ap-southeast-1`. Shell: zsh (the subshell in step 7 uses zsh's
  `read` syntax).

## Decisions

| Fork                                        | Choice                                                                                     | Why                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Where the secret key lives before ticket 04 | An empty Railway service named `backup` in production, with `AWS_SECRET_ACCESS_KEY` sealed | `infra/aws/README.md` already planned the empty service. Railway never shows a sealed value in the UI, API or CLI. |

## Steps

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

- Open point from the research: Railway's docs don't describe renaming a service, or what deploying
  staged variables does on a service with no source (steps 5 and 6b).
- Open point from the research: the IAM docs say to choose **Other**, while the README names
  **Application running outside AWS** (step 6a).
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
