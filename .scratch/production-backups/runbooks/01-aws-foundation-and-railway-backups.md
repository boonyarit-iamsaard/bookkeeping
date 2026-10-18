# Runbook: AWS foundation and Railway's own backups

- **Source:** `.scratch/production-backups/issues/01-aws-foundation-and-railway-backups.md`
- **Docs checked:** 2026-10-18
- **Estimated time:** 90 minutes · **Estimated cost:** $0 on AWS (Organizations
  and IAM Identity Center have no charge; nothing billable is created). On
  Railway, a few cents a month for backup storage at the volume's per-GB rate:
  the database is 8.7 MB and backups are incremental.

Every identifier below is a placeholder. Substitute the real value on screen;
never write it into this file. The repository is public.

## Prerequisites

- [x] AWS CLI v2, version 2.22.0 or later (PKCE sign-in is the default from
      2.22.0). Not installed on this machine yet. Install it with the user-level
      script, then check the version:

  ```sh
  curl -fsSL https://awscli.amazonaws.com/v2/install.sh | bash
  aws --version
  # aws-cli/2.38.1 Python/3.14.6 Linux/6.18.33.1-microsoft-standard-WSL2 script-exe/x86_64.ubuntu.2
  ```

  Source: <https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html>

- [x] `age` 1.x. Already installed here (`age --version` prints `v1.3.2`).

  ```sh
  # 1.3.2
  ```

- [x] Docker. Already installed. Used only for optional checks in step 13.
- [x] Optional: the Railway CLI, used only for read-only checks in steps
      14 and 15. Without it, you report what the dashboard shows instead.

  ```sh
  npm i -g @railway/cli
  railway login
  # 5.70.0
  # Signed in as <OWNER_NAME> (<OWNER_EMAIL>)
  ```

  Source: <https://docs.railway.com/cli>

- [x] Root sign-in for the existing AWS account: `<ROOT_EMAIL>`, its password,
      and access to that inbox.
- [x] An authenticator app on your phone, for root MFA and Identity Center MFA.
- [x] The burned `age` key file `<OLD_KEY_FILE>` and the manual dump encrypted
      with it, `<OLD_DUMP_FILE>`, both from 2026-10-17.
- [x] A password manager entry and an offline medium (USB stick or paper) for
      the new `age` key.
- Region: `ap-southeast-1` (Asia Pacific, Singapore) for Identity Center and
  every CLI profile. Railway project: production, service `database`.

## Decisions

| Fork                                                 | Choice                                                                                           | Why                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Free plan upgrade when the Organization is created   | Check the plan first (step 1); stop if it is Free and you don't accept the upgrade               | You weren't sure which plan the account is on, and AWS upgrades a Free plan automatically and irreversibly.                               |
| Owner access to the management account               | The Identity Center user gets `AdministratorAccess` on both `backups` and the management account | Without it, managing the Organization needs root. AWS also refuses root for privileged root actions on member accounts.                   |
| Order of root access management and account creation | Turn on centralized root access before creating `backups`                                        | AWS creates new member accounts with no root credentials once the feature is on, so nothing needs deleting afterwards.                    |
| Identity Center instance type                        | Organization instance, single Region                                                             | The multi-Region option creates a customer-managed KMS key, which costs money and goes against the spec's "no customer-managed KMS keys". |
| Identity Center MFA mode                             | Always-on, and users must register a device at sign-in                                           | These are the most secure options; always-on is the default prompt mode.                                                                  |
| Railway point-in-time recovery                       | Leave PITR off                                                                                   | It is out of scope in the spec, and it creates a bucket and redeploys Postgres.                                                           |
| Railway CLI                                          | Optional; recommended                                                                            | It lets the agent check the proxy, schedules and variable names without screenshots. Every check also works from the dashboard.           |
| Fate of the old dump and key                         | Delete both once the re-encrypted dump is verified                                               | The old private key was shown in a screenshot, so a copy of the old ciphertext is readable by anyone who saw it.                          |

## Steps

### 1. Check the account plan

- [x] **Done** (tick once Verify passes)
- **Goal:** Know whether the account is on the Free plan before step 4
  changes it.
- **Why:** AWS states that a Free account plan "will automatically upgrade to
  paid plan if you join AWS Organizations". The Identity Center guide adds
  that free tier credits "expire immediately" on that upgrade, while the
  Billing guide says remaining credits apply to future bills. The two pages
  disagree, so read your own console.
- **Where:** Console, signed in as root → **Billing and Cost Management** home
  (per docs, verify on screen).
- **Do:**
  1. Sign in at <https://console.aws.amazon.com/> as root.
  2. Open <https://console.aws.amazon.com/costmanagement/>.
  3. Look for a Free plan banner, a credit balance, or an **Upgrade plan** link.
- **Expect:** Either no Free plan banner (the account is on the paid plan or
  the legacy free tier), or a Free plan banner with days and credits left.
- **Verify:** Tell me which one you see and roughly how many credits remain.
  If it is the Free plan, say whether you accept the upgrade. If you don't,
  stop here: the rest of the runbook depends on the Organization.
- **Undo:** Nothing changes in this step.
- **Ticks:** none; it gates step 4.
- **Source:** <https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html>,
  <https://docs.aws.amazon.com/singlesignon/latest/userguide/enable-identity-center.html>

### 2. Give root an MFA device

- [x] **Done**
- **Goal:** The management account's root user has MFA.
- **Why:** Root has full control of every account in the Organization you are
  about to create.
- **Where:** Console as root → account name (top right) → **Security
  credentials** → **Multi-factor authentication (MFA)** (per docs, verify on
  screen).
- **Do:**
  1. If a device is already listed, skip to Verify.
  2. Choose **Assign MFA device**, enter a device name, choose
     **Authenticator app**, then **Next**.
  3. Choose **Show QR code** and scan it with the app.
  4. Enter two consecutive codes in **MFA code 1** and **MFA code 2** and
     choose **Add MFA** straight away, before the codes expire.
  5. Optional but recommended by AWS: register a second device, so that losing
     your phone doesn't lock you out. Up to eight are allowed.
- **Expect:** The MFA section lists the device.
- **Verify:** Sign out and back in as root; the MFA prompt appears. The CLI
  check comes in step 12, once a management-account profile exists.
- **Undo:** Remove the device from the same section.
- **Ticks:** "Root of the existing account has MFA" (together with step 3).
- **Source:** <https://docs.aws.amazon.com/IAM/latest/UserGuide/enable-virt-mfa-for-root.html>

### 3. Remove any root access keys

- [x] **Done**
- **Goal:** Root has no access keys.
- **Why:** A root access key is a long-lived credential with full control of the
  account and nothing to limit it.
- **Where:** Console as root → **Security credentials** → **Access keys** (per
  docs, verify on screen).
- **Do:**
  1. If the section lists no keys, skip to Verify.
  2. For each key: **Actions** → **Deactivate**. Confirm nothing you use
     breaks, then **Actions** → **Delete**.
- **Expect:** The **Access keys** section is empty.
- **Verify:** Tell me the section is empty. Step 12 re-checks this with
  `AccountAccessKeysPresent`.
- **Undo:** ⚠️ Irreversible: a deleted access key cannot be restored. Only a
  new key can be created.
- **Ticks:** "no root access keys exist" (with step 2, the first criterion).
- **Source:** <https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-access-key.html>

### 4. Create the Organization with all features

- [x] **Done**
- **Goal:** The existing account becomes the management account of an
  Organization with all features.
- **Why:** "All features" is needed for SCPs and centralized root access;
  consolidated billing alone is not enough.
- **Where:** Console as root → AWS Organizations,
  <https://console.aws.amazon.com/organizations/v2> (per docs, verify on screen).
- **Do:**
  1. On the introduction page, choose **Create an organization**. Do not
     choose the **consolidated billing features** link.
  2. If AWS sends a verification email to `<ROOT_EMAIL>`, confirm it within
     24 hours. Creating accounts works without it.
- **Expect:** The **AWS accounts** page lists one account, the management
  account, under Root. AWS also turns on SCPs and attaches a default SCP that
  stops member accounts from leaving the Organization or closing themselves.
  Keep it attached.
- **Verify:** Step 12 runs
  `aws organizations describe-organization --profile bookkeeping-management`,
  which should show `"FeatureSet": "ALL"` and `MasterAccountId` =
  `<MANAGEMENT_ACCOUNT_ID>`. For now, tell me the accounts page shows one
  account.
- **Undo:** If you chose the wrong feature set, go to **Settings** →
  **Delete organization** at once and start over. ⚠️ Once member accounts
  exist, the Organization cannot be deleted until they are removed. A Free plan
  upgrade cannot be reversed either.
- **Ticks:** "AWS Organizations enabled with all features; the existing account
  is the management account."
- **Source:** <https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_org_create.html>

### 5. Turn on centralized root access for member accounts

- [x] **Done**
- **Goal:** The management account can manage member accounts' root
  credentials. New member accounts are created with none.
- **Why:** The spec removes root sign-in from `backups`. AWS documents that once
  this feature is on, "New accounts you create in AWS Organizations have no
  root user credentials by default."
- **Where:** Console as root → IAM → **Root access management** (per docs,
  verify on screen).
- **Do:**
  1. Choose **Enable**. If the page says **Root access management is
     disabled**, first turn on trusted access for IAM in AWS Organizations
     (Organizations → **Services** → AWS Identity and Access Management), then
     come back.
  2. Under **Capabilities to enable**, select both **Root credentials
     management** and **Privileged root actions in member accounts**.
  3. Leave **Delegated administrator** empty.
  4. Choose **Enable**.
- **Expect:** The page lists the capabilities as enabled.
- **Verify:** Step 12 runs
  `aws iam list-organizations-features --profile bookkeeping-management`,
  which should list `RootCredentialsManagement` and `RootSessions`. If the
  feature is not offered at all, tell me and I record that under the issue's
  Comments, as its criterion allows.
- **Undo:** The same page can turn the capabilities off.
- **Ticks:** First half of "Centralized root access management enabled for
  member accounts…".
- **Source:** <https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-enable-root-access.html>

### 6. Create the `backups` member account

- [x] **Done**
- **Goal:** A member account named `backups` exists in the Organization.
- **Why:** It keeps the backups away from SAA-C03 practice and from the
  management account.
- **Where:** Organizations → **AWS accounts** → **Add an AWS account** →
  **Create an AWS account** (per docs, verify on screen).
- **Do:**
  1. **AWS account name:** `backups`.
  2. **Email address of the account's owner:** `<BACKUPS_ROOT_EMAIL>`, a plus
     address in your usual inbox, for example `<YOUR_LOCAL_PART>+aws-backups@<YOUR_DOMAIN>`.
     It must not already belong to another AWS account.
  3. **IAM role name:** leave it empty, so the default
     `OrganizationAccountAccessRole` is used.
  4. Choose **Create AWS account**. If AWS says the Organization is still
     initializing, wait an hour and retry.
- **Expect:** `backups` appears on the **AWS accounts** page, possibly after a
  short wait. A "Welcome to AWS" email arrives at the plus address.
- **Verify:** Tell me the account is listed, and its 12-digit ID is
  `<BACKUPS_ACCOUNT_ID>`. Keep the ID for step 11. Step 12 checks it with
  `aws organizations list-accounts`.
- **Undo:** ⚠️ Hard to reverse: closing an account takes a post-closure period,
  the email address stays tied to it, and the default SCP blocks the account
  from closing itself.
- **Ticks:** "Member account `backups` created with a plus-addressed root email
  in the owner's usual inbox."
- **Source:** <https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_accounts_create.html>

### 7. Enable IAM Identity Center in `ap-southeast-1`

- [x] **Done**
- **Goal:** An organization instance of Identity Center in Singapore.
- **Why:** It gives you one sign-in, with MFA, for both accounts and
  short-lived CLI credentials, so no IAM user or access key exists for you.
- **Where:** Console as root, **Region selector set to Asia Pacific
  (Singapore)** → IAM Identity Center, <https://console.aws.amazon.com/singlesignon>
  (per docs, verify on screen).
- **Do:**
  1. Check the Region selector shows `ap-southeast-1` before anything else.
  2. If an **Instance configuration** choice appears, choose **Single-Region
     instance**.
  3. Leave the encryption key on the AWS managed default, and keep **Enable
     multi-account permissions** on.
  4. Choose **Enable**.
- **Expect:** The Identity Center dashboard opens. **Settings** shows the
  Region as `ap-southeast-1`, the identity source as **Identity Center
  directory**, and an **AWS access portal URL** of the form
  `https://<PORTAL_ID>.awsapps.com/start`.
- **Verify:** Tell me the Region and identity source shown on **Settings**.
  Step 12 runs `aws sso-admin list-instances`.
- **Undo:** ⚠️ The Region cannot be changed. Moving Regions means deleting the
  instance and building it again.
- **Ticks:** First part of "IAM Identity Center enabled in `ap-southeast-1`…".
- **Source:** <https://docs.aws.amazon.com/singlesignon/latest/userguide/enable-identity-center.html>

### 8. Require MFA in Identity Center

- [x] **Done**
- **Goal:** Every sign-in to the access portal asks for MFA, and a user without
  a device has to register one.
- **Why:** The issue requires an owner user with MFA. Making it mandatory means
  it cannot be skipped later.
- **Where:** IAM Identity Center → **Settings** → **Authentication** tab →
  **Multi-factor authentication** → **Configure** (per docs, verify on screen).
- **Do:**
  1. **Prompt users for MFA:** **Every time they sign in (always-on)**.
  2. **If a user does not yet have a registered MFA device:** **Require them to
     register an MFA device at sign in**.
  3. Leave the MFA types at their defaults (authenticator apps and security
     keys or built-in authenticators).
  4. Choose **Save changes**.
- **Expect:** The **Authentication** tab shows always-on and the registration
  requirement.
- **Verify:** Tell me what the **Multi-factor authentication** section shows.
  Step 10 proves it, because the first sign-in asks you to register a device.
- **Undo:** Change the settings on the same page.
- **Ticks:** Part of "…one owner user with MFA…".
- **Source:** <https://docs.aws.amazon.com/singlesignon/latest/userguide/mfa-getting-started.html>,
  <https://docs.aws.amazon.com/singlesignon/latest/userguide/how-to-configure-mfa-device-enforcement.html>

### 9. Add the owner user and assign both accounts

- [x] **Done**
- **Goal:** One Identity Center user with `AdministratorAccess` on `backups`
  and on the management account.
- **Why:** This user replaces root for daily work. The management assignment is
  the decision recorded above.
- **Where:** IAM Identity Center → **Users**, then **Multi-account
  permissions** → **AWS accounts** (per docs, verify on screen).
- **Do:**
  1. **Users** → **Add user**:
     - **Username:** `<SSO_USERNAME>`. It cannot be changed later.
     - **Password:** **Send an email to this user with password setup
       instructions**.
     - **Email address:** `<OWNER_EMAIL>`. It must be unique in the directory.
     - First name, last name, display name: your own.
     - **Next**, skip groups, **Next**, **Add user**.
  2. **AWS accounts** → tick the `backups` account and the management account
     → **Assign users or groups**:
     - **Users** tab: select `<SSO_USERNAME>` → **Next**.
     - **Create permission set** (opens a new tab): **Predefined permission
       set** → **AdministratorAccess** → **Next** → keep the defaults (name
       `AdministratorAccess`, session duration 1 hour) → **Next** →
       **Create**. Close the tab.
     - Back on the assignment tab, refresh, select `AdministratorAccess` →
       **Next** → **Submit**.
  3. Wait until both accounts show as provisioned.
- **Expect:** Each account's detail page lists `<SSO_USERNAME>` with
  `AdministratorAccess`. An email titled "Invitation to join AWS IAM Identity
  Center" arrives from `no-reply@signin.aws` or `no-reply@login.awsapps.com`.
- **Verify:** Tell me both accounts list the assignment. Step 12 checks it
  from the CLI.
- **Undo:** Remove the assignment, permission set or user on the same pages.
- **Ticks:** "…assigned to `backups` with administrator access."
- **Source:** <https://docs.aws.amazon.com/singlesignon/latest/userguide/get-started-assign-account-access-admin-user.html>,
  <https://docs.aws.amazon.com/singlesignon/latest/userguide/addusers.html>

### 10. Accept the invitation and register MFA

- [x] **Done**
- **Goal:** The owner user has a password and a registered MFA device, and can
  sign in to the access portal.
- **Why:** This proves the MFA requirement from step 8 works.
- **Where:** The invitation email → **Accept invitation** (per docs, verify on
  screen).
- **Do:**
  1. Open the email and choose **Accept invitation**. The link expires after
     7 days.
  2. Set a password and store it in your password manager.
  3. Register an MFA device when prompted. A second device is recommended.
  4. Sign in at the access portal URL, `https://<PORTAL_ID>.awsapps.com/start`.
  5. From now on, sign out of the root session. Root is for break-glass tasks
     only.
- **Expect:** The portal lists two accounts, each with `AdministratorAccess`.
- **Verify:** Tell me the portal shows both accounts, and that sign-in asked
  for an MFA code.
- **Undo:** An administrator can reset the password or remove the MFA device
  from the user's detail page.
- **Ticks:** Completes "IAM Identity Center enabled in `ap-southeast-1`, one
  owner user with MFA, assigned to `backups` with administrator access."
- **Source:** <https://docs.aws.amazon.com/singlesignon/latest/userguide/get-started-assign-account-access-admin-user.html>

### 11. Configure the CLI profiles

- [x] **Done**
- **Goal:** `~/.aws/config` has one SSO session, `bookkeeping`, and two
  profiles, `bookkeeping-backups` and `bookkeeping-management`.
- **Why:** Later tickets deploy the template and run the restore drill through
  `aws sso login` with the `bookkeeping-backups` profile.
- **Where:** This machine's terminal.
- **Do:**
  1. Run `aws configure sso` and answer:
     - SSO session name: `bookkeeping`
     - SSO start URL: `https://<PORTAL_ID>.awsapps.com/start`
     - SSO region: `ap-southeast-1`
     - SSO registration scopes: `sso:account:access`
  2. Approve the request in the browser (the client name starts with
     `botocore-client-`). Under WSL, if no browser opens, copy the printed URL
     into your Windows browser. If that fails, rerun with `--use-device-code`.
  3. Choose the `backups` account, then `AdministratorAccess`.
  4. Default client Region: `ap-southeast-1`. Output format: `json`. Profile
     name: `bookkeeping-backups`.
  5. Run `aws configure sso` again, reuse the `bookkeeping` session, choose the
     management account, and name the profile `bookkeeping-management`.
- **Expect:** `~/.aws/config` contains `[sso-session bookkeeping]` and both
  `[profile …]` sections, each with an `sso_account_id`. It contains no access
  keys.
- **Verify:** I run, read-only:

  ```sh
  aws sso login --sso-session bookkeeping   # you approve this in the browser
  aws sts get-caller-identity --profile bookkeeping-backups
  ```

  `Account` must be `<BACKUPS_ACCOUNT_ID>`, and `Arn` must contain
  `AWSReservedSSO_AdministratorAccess`.

- **Undo:** Delete the sections from `~/.aws/config` and run `aws sso logout`.
- **Ticks:** "`aws sso login` works locally with a profile named
  `bookkeeping-backups`; `aws sts get-caller-identity --profile
bookkeeping-backups` shows the `backups` account."
- **Source:** <https://docs.aws.amazon.com/cli/latest/userguide/sso-configure-profile-token.html>

### 12. Check the AWS side from the CLI

- [x] **Done**
- **Goal:** Read-only confirmation of steps 2 to 9.
- **Why:** The console checks so far were your own reports; these come from the
  API.
- **Where:** This machine's terminal. I run them.
- **Do:** Nothing for you to do, unless the SSO session has expired; if so, run
  `aws sso login --sso-session bookkeeping`.

  ```sh
  P=--profile=bookkeeping-management
  aws iam get-account-summary $P \
    --query 'SummaryMap.{RootAccessKeysPresent:AccountAccessKeysPresent,RootMFAEnabled:AccountMFAEnabled}'
  aws organizations describe-organization $P \
    --query 'Organization.{FeatureSet:FeatureSet,Management:MasterAccountId}'
  aws organizations list-accounts $P --query 'Accounts[].{Name:Name,Status:Status}'
  aws iam list-organizations-features $P
  aws sso-admin list-instances $P --region ap-southeast-1 --query 'Instances[].Status'
  ```

- **Expect:** `RootAccessKeysPresent: 0`, `RootMFAEnabled: 1`;
  `FeatureSet: ALL`; two `ACTIVE` accounts, one of them `backups`;
  `EnabledFeatures` includes `RootCredentialsManagement` and `RootSessions`;
  one `ACTIVE` Identity Center instance.
- **Verify:** The output above. I quote only names and statuses in the Run
  log, never account IDs.
- **Undo:** Read-only.
- **Ticks:** Confirms the first, second and fourth criteria.
- **Source:** <https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-access-key.html>,
  <https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-enable-root-access.html>

### 13. Confirm `backups` has no root credentials

- [x] **Done**
- **Goal:** `backups` has no root password, access keys, signing certificates
  or MFA.
- **Why:** The account was created after step 5, so it should have none. This
  step checks that, and removes any that exist.
- **Where:** Console, signed in through the access portal to the
  **management** account as `AdministratorAccess` (not root: AWS refuses
  `sts:AssumeRoot` for root) → IAM → **Root access management** (per docs,
  verify on screen).
- **Do:**
  1. Find `backups` in the member account list and read its root credential
     status.
  2. If any root credential is present: select `backups` → **Take privileged
     action** → **Delete root credentials** → **Delete root credentials**.
- **Expect:** The `backups` row shows no root user credentials.
- **Verify:** Tell me what the row shows. If the console doesn't show the
  status, you can run this audit-only check yourself (it prints short-lived
  credentials, so run it in your own terminal, not through me):

  ```sh
  aws sts assume-root --profile bookkeeping-management --region ap-southeast-1 \
    --target-principal <BACKUPS_ACCOUNT_ID> \
    --task-policy-arn arn=arn:aws:iam::aws:policy/root-task/IAMAuditRootUserCredentials
  ```

  With those credentials, `aws iam get-login-profile` should fail with
  `NoSuchEntity`, and `aws iam list-access-keys` and `aws iam list-mfa-devices`
  should return empty lists.

- **Undo:** **Take privileged action** → **Allow password recovery** lets the
  holder of `<BACKUPS_ROOT_EMAIL>` reset a root password later.
- **Ticks:** Completes "Centralized root access management enabled for member
  accounts, and root credentials removed from `backups`…".
- **Source:** <https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user-privileged-task.html>

### 14. Turn on Railway's own backups for Postgres

- [ ] **Skipped:** needs Railway Pro; see the Run log.
- **Goal:** Daily, weekly and monthly backup schedules on the `Postgres`
  service, plus one manual backup.
- **Why:** These are the fastest restore path for everyday mistakes. They don't
  satisfy ADR 0008: a backup kept in the same account is deleted when the
  volume is wiped.
- **Where:** Railway dashboard → production project → `Postgres` service →
  **Backups** tab (per docs, verify on screen).
- **Do:**
  1. Select all three schedules: **Daily**, **Weekly** and **Monthly**.
  2. Create a manual backup from the same tab. Manual backups are limited to
     50% of the volume's size, which is far above 8.7 MB.
  3. Do not choose **Enable PITR**.
- **Expect:** The tab lists the three schedules and one backup with today's
  date stamp. Retention is 6 days for daily, 27 for weekly and 89 for
  monthly; the Postgres guide rounds these to 1 and 3 months.
- **Verify:** With the Railway CLI, I run, read-only:

  ```sh
  railway postgres pitr schedule list --service Postgres --environment production
  railway postgres pitr backup list --service Postgres --environment production
  ```

  Without it, tell me what the Backups tab shows.

- **Undo:** Deselect the schedules. A manual backup can be deleted from the
  same tab.
- **Ticks:** "Railway Postgres service, Backups tab: daily, weekly and monthly
  schedules enabled; one manual backup taken."
- **Source:** <https://docs.railway.com/volumes/backups>,
  <https://docs.railway.com/guides/postgres-backups-restores>,
  <https://docs.railway.com/cli/postgres>

### 15. Confirm the TCP proxy is gone

- [x] **Done**
- **Goal:** `database` has no TCP proxy, and no `DATABASE_PUBLIC_URL`
  variable.
- **Why:** The proxy exposed the database to the internet for the 2026-10-17
  dump. The spec keeps the database on the private network. The build log says
  the proxy was closed; this step proves it.
- **Where:** Railway dashboard → `database` → **Settings** → **Networking**,
  then **Variables** (per docs, verify on screen).
- **Do:**
  1. If a TCP proxy is listed, delete it with its trash icon.
  2. Open **Variables** and check `DATABASE_PUBLIC_URL` is not listed. The
     docs say Railway fills that variable when public access creates a TCP
     proxy. They don't say that deleting the proxy removes it, so delete it by
     hand if it is still listed.
  3. Check that no other service references `database.DATABASE_PUBLIC_URL`.
     The api should reference `${{database.DATABASE_URL}}` only.
- **Expect:** No TCP proxy under Networking, and no `DATABASE_PUBLIC_URL`.
- **Verify:** With the Railway CLI, I run read-only commands that print names,
  never values:

  ```sh
  railway tcp-proxy list --service database --environment production
  railway variable list --service database --environment production -k | cut -d= -f1
  ```

  The first should list nothing, and the second should not include
  `DATABASE_PUBLIC_URL`. Without the CLI, tell me what both dashboard pages
  show.

- **Undo:** A TCP proxy can be added again under **Networking**. Don't, unless
  a later ticket needs one.
- **Ticks:** "The Railway TCP proxy used for the 2026-10-17 manual dump is
  disabled and `DATABASE_PUBLIC_URL` is gone."
- **Source:** <https://docs.railway.com/databases/postgresql>,
  <https://docs.railway.com/cli/tcp-proxy>,
  <https://docs.railway.com/cli/variable>,
  <https://docs.railway.com/networking/domains/working-with-domains>

### 16. Replace the exposed `age` key and re-encrypt the dump

- [x] **Done**
- **Goal:** A new `age` key pair, the 2026-10-17 dump encrypted with it, the
  new private key in two places, and the burned key and old ciphertext deleted.
- **Why:** The old private key appeared in a screenshot. Ticket 04's job must
  use the replacement, and losing the new key makes every backup unreadable.
- **Where:** Your terminal, not through me: the private key must never reach
  this session.
- **Do:**
  1. Generate the key with owner-only permissions. `age-keygen` prints the
     public key and nothing else; never `cat` the key file.

     ```sh
     (umask 077 && age-keygen -o <NEW_KEY_FILE>)
     age-keygen -y <NEW_KEY_FILE>   # the public key, age1…, safe to share
     ```

  2. Re-encrypt in a single pipe, so the plaintext never touches disk:

     ```sh
     age -d -i <OLD_KEY_FILE> <OLD_DUMP_FILE> \
       | age -r <NEW_AGE_PUBLIC_KEY> -o <NEW_DUMP_FILE>
     ```

  3. Check the two files decrypt to identical bytes:

     ```sh
     age -d -i <OLD_KEY_FILE> <OLD_DUMP_FILE> | sha256sum
     age -d -i <NEW_KEY_FILE> <NEW_DUMP_FILE> | sha256sum
     ```

  4. Store the contents of `<NEW_KEY_FILE>` in your password manager and on an
     offline medium. Test both copies: decrypt `<NEW_DUMP_FILE>` with each, and
     compare the hash with step 3.
  5. Only after steps 3 and 4 pass, delete `<OLD_DUMP_FILE>` and every copy of
     `<OLD_KEY_FILE>`, including any in your password manager.
  6. Note the new public key somewhere handy. Ticket 03 puts it in Railway as
     `AGE_RECIPIENT`.
- **Expect:** Both hashes match. Two tested copies of the new key exist, and no
  copy of the old key.
- **Verify:** Tell me the two hashes match (the hash itself is not secret, so
  you can paste it), and that both stored copies decrypted the file. I check
  the new ciphertext's header, without needing a key:

  ```sh
  head -c 64 <NEW_DUMP_FILE> | head -n 2
  ```

  It should start `age-encryption.org/v1` with one `-> X25519` stanza.

- **Undo:** ⚠️ Irreversible: once the old key is deleted, the old ciphertext
  cannot be decrypted, which is the point. Don't do step 5 until step 4 has
  passed on both copies.
- **Ticks:** "The exposed `age` key from 2026-10-17 is replaced, the manual
  dump re-encrypted with the new key, and the new key stored in two places."
- **Source:** <https://github.com/FiloSottile/age/blob/main/README.md>

## Run log

### 2026-10-18

- Completed: runbook written. Steps 2 and 3 verified from a screenshot of the root Security credentials page: one virtual MFA device, registered in 2021, and Access keys (0). Nothing needed changing.
- Deviations from docs: none yet. Open points from the research:
  - The Identity Center and Billing guides disagree on what happens to free
    credits on the upgrade (step 1).
  - Railway's docs don't say that deleting the TCP proxy removes
    `DATABASE_PUBLIC_URL`, or name the manual-backup button (steps 14 and 15).
  - The IAM docs don't say whether the Root access management page shows each
    account's credential status (step 13).
- Completed: step 16. New key at `<NEW_KEY_FILE>` (mode 600). The dump was
  re-encrypted to `<NEW_DUMP_FILE>`; its header has one `-> X25519` stanza.
  The old and new ciphertexts decrypt to the same SHA-256. Both stored copies
  decrypted the dump to that hash. The old key, the old dump and the
  screenshot were then deleted.
- Deviation: the second copy is not on an offline medium. It is a
  passphrase-encrypted copy of the key file (`age -p`, `-> scrypt` stanza) in
  the owner's cloud drive, usable directly with `age -d -i`. The passphrase is
  kept outside the password manager, so the two copies don't share a point of
  failure. The first copy is a password-manager note, tested by piping the
  clipboard into `age -d -i -`.
- Completed: step 1, from a screenshot of the Billing and Cost Management home
  as root. No Free plan banner and no **Upgrade plan** link; month-to-date and
  last month's cost $0.00. The account dates from 2021, before the Free plan
  existed, so it is on the paid plan and creating the Organization upgrades
  nothing.
- Completed: step 4, from a screenshot of the AWS accounts page: one account
  under Root, tagged management account. The verification email is already
  confirmed.
- Completed: step 5. `aws iam list-organizations-features` lists
  `RootSessions` and `RootCredentialsManagement`.
- Deviation: the console path didn't match the docs. IAM's Root access
  management page needed trusted access first, which was turned on from
  Organizations → Services → AWS Identity and Access Management (the "without
  additional setup tasks" option, confirmed by typing `enable`). The IAM page
  then showed the account tree with no **Enable** button or capability
  choices, and the CLI listed no features. Both were turned on from
  CloudShell, as root, with
  `aws iam enable-organizations-root-credentials-management` and
  `aws iam enable-organizations-root-sessions`.
- Completed: step 6, from a screenshot of the AWS accounts page: `backups`
  listed with its plus-addressed root email and the default
  `OrganizationAccountAccessRole`.
- Completed: step 7, from a screenshot of Identity Center **Settings**:
  organization instance, single-Region, primary Region `ap-southeast-1`, AWS
  owned encryption key, identity source Identity Center directory.
  Identity-enhanced sessions left disabled; nothing here needs them. The
  Settings page lists two portal URLs, an IPv4-only `awsapps.com/start` one
  (used for the CLI in step 11) and a dual-stack `portal.<region>.app.aws` one.
- Completed: step 8, from a screenshot of the **Authentication** tab: MFA
  always-on, authenticator apps plus security keys and built-in
  authenticators, and users without a device must register one at sign-in.
  These were already the defaults; saved anyway.
- Completed: step 9, from screenshots. Permission set `AdministratorAccess`
  (predefined, 1-hour session) was created on its own before assigning,
  rather than from the assignment flow. Its **AWS accounts** tab lists both
  accounts as "Up to date".
- Completed: step 10. First sign-in required registering an MFA device (an
  authenticator app on the phone); the password is in the password manager.
  The portal lists both accounts, each with `AdministratorAccess`.
- Completed: step 11. `~/.aws/config` has `[sso-session bookkeeping]` and the
  `bookkeeping-backups` and `bookkeeping-management` profiles, and no access
  keys; there is no `~/.aws/credentials`. `aws sts get-caller-identity` for
  each profile returns the expected account with an
  `AWSReservedSSO_AdministratorAccess_…` role. Declined the CLI's offer to
  configure AWS skills and an MCP server for AI coding agents.
- Completed: step 12. Root access keys 0, root MFA 1; `FeatureSet` `ALL`;
  two `ACTIVE` accounts, one `backups`; `RootSessions` and
  `RootCredentialsManagement` enabled; one `ACTIVE` Identity Center instance.
- Completed: step 13, by the CLI audit (`sts assume-root` with
  `IAMAuditRootUserCredentials`, run by the owner with credentials kept in a
  subshell). `get-login-profile` fails with `NoSuchEntity`; access keys, MFA
  devices and signing certificates are all empty. Nothing needed deleting:
  `backups` was created with no root credentials, as step 5 intended.
- Skipped: step 14. The `database` service's **Backups** tab says the
  current plan can only view, restore and delete backups; creating backups,
  schedules and PITR need Pro. The owner chose to stay on Hobby and drop
  Railway's own backups. The off-Railway job (tickets 02 to 06) is what ADR
  0008 requires. Until ticket 04 ships, the re-encrypted 2026-10-17 dump is
  the only copy of the data outside the volume.
- Deviation: the Postgres service is named `database`, not `Postgres`; steps
  14 and 15 are corrected.
- Completed: step 15, from the CLI after `railway link` (names and counts
  only). `railway tcp-proxy list` finds no TCP proxies on `database`. Its
  variables include `DATABASE_URL` and no `DATABASE_PUBLIC_URL` or
  `RAILWAY_TCP_PROXY_*`. No `api` variable value points at a
  `proxy.rlwy.net` host or `DATABASE_PUBLIC_URL`. Nothing needed deleting.
