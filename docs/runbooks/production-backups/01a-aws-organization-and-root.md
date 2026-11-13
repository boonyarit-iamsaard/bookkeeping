# Runbook: AWS Organization and root lockdown

- **Source:** [#219](https://github.com/boonyarit-iamsaard/bookkeeping/issues/219)
- **Docs checked:** 2026-10-18
- **Estimated time:** 90 minutes for all three parts · **Estimated cost:** $0
  on AWS (Organizations has no charge; nothing billable is created).

Part 1 of 3. Step numbers run across the parts: steps 1 to 6 are here, steps
7 to 13 are in `01b-identity-center-and-cli.md`, and steps 14 to 16 are in
`01c-railway-hardening-and-age-key.md`.

Every identifier below is a placeholder. Substitute the real value on screen;
never write it into this file. The repository is public.

## Prerequisites

- [x] Root sign-in for the existing AWS account: `<ROOT_EMAIL>`, its password,
      and access to that inbox.
- [x] An authenticator app on your phone, for root MFA and Identity Center MFA.

## Decisions

| Fork                                                 | Choice                                                                             | Why                                                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Free plan upgrade when the Organization is created   | Check the plan first (step 1); stop if it is Free and you don't accept the upgrade | You weren't sure which plan the account is on, and AWS upgrades a Free plan automatically and irreversibly.            |
| Order of root access management and account creation | Turn on centralized root access before creating `backups`                          | AWS creates new member accounts with no root credentials once the feature is on, so nothing needs deleting afterwards. |

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

## Run log

### 2026-10-18

- Completed: runbook written. Steps 2 and 3 verified from a screenshot of the root Security credentials page: one virtual MFA device, registered in 2021, and Access keys (0). Nothing needed changing.
- Deviations from docs: none yet.
- Open point from the research: the Identity Center and Billing guides disagree on what happens to free
  credits on the upgrade (step 1).
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
