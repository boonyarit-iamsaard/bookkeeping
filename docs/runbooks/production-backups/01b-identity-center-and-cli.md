# Runbook: IAM Identity Center and CLI access

- **Source:** [#219](https://github.com/boonyarit-iamsaard/bookkeeping/issues/219)
- **Docs checked:** 2026-10-18
- **Estimated time:** 90 minutes for all three parts · **Estimated cost:** $0
  (IAM Identity Center has no charge).

Part 2 of 3. Step numbers run across the parts: steps 1 to 6 are in
`01a-aws-organization-and-root.md`, steps 7 to 13 are here, and steps 14 to
16 are in `01c-railway-hardening-and-age-key.md`.

Every identifier below is a placeholder. Substitute the real value on screen;
never write it into this file. The repository is public.

## Prerequisites

- [x] Steps 1 to 6 done: the Organization exists, centralized root access is
      on, and the `backups` account is created.
- [x] AWS CLI v2, version 2.22.0 or later (PKCE sign-in is the default from
      2.22.0). Not installed on this machine yet. Install it with the user-level
      script, then check the version:

  ```sh
  curl -fsSL https://awscli.amazonaws.com/v2/install.sh | bash
  aws --version
  # aws-cli/2.38.1 Python/3.14.6 Linux/6.18.33.1-microsoft-standard-WSL2 script-exe/x86_64.ubuntu.2
  ```

  Source: <https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html>

- [x] Docker. Already installed. Used only for optional checks in step 13.
- [x] Root sign-in for the existing AWS account: `<ROOT_EMAIL>`, its password,
      and access to that inbox.
- [x] An authenticator app on your phone, for root MFA and Identity Center MFA.
- Region: `ap-southeast-1` (Asia Pacific, Singapore) for Identity Center and
  every CLI profile.

## Decisions

| Fork                                   | Choice                                                                                           | Why                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Owner access to the management account | The Identity Center user gets `AdministratorAccess` on both `backups` and the management account | Without it, managing the Organization needs root. AWS also refuses root for privileged root actions on member accounts.                   |
| Identity Center instance type          | Organization instance, single Region                                                             | The multi-Region option creates a customer-managed KMS key, which costs money and goes against the spec's "no customer-managed KMS keys". |
| Identity Center MFA mode               | Always-on, and users must register a device at sign-in                                           | These are the most secure options; always-on is the default prompt mode.                                                                  |

## Steps

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
  aws organizations list-accounts $P --query 'Accounts[].{Name:Name,State:State}'
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
  `NoSuchEntity`, and `aws iam list-access-keys`, `aws iam list-mfa-devices`
  and `aws iam list-signing-certificates` should return empty lists.

- **Undo:** **Take privileged action** → **Allow password recovery** lets the
  holder of `<BACKUPS_ROOT_EMAIL>` reset a root password later.
- **Ticks:** Completes "Centralized root access management enabled for member
  accounts, and root credentials removed from `backups`…".
- **Source:** <https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user-privileged-task.html>

## Run log

### 2026-10-18

- Open point from the research: the IAM docs don't say whether the Root access management page shows each
  account's credential status (step 13).
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
