# 01: Set up the AWS accounts and Railway's own backups

Read `../spec.md` first (AWS accounts and access, Railway's own backups).

**What to build:** The owner's existing AWS account becomes an Organization's
management account with a dedicated `backups` member account, the owner signs
in through IAM Identity Center with MFA, and Railway's own volume backups run
on the production Postgres service.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Notes:** Accounts, credentials and MFA are the owner's to handle. An agent
can prepare a step-by-step walkthrough (the `/wizard` skill) but does not
enter credentials.

- [ ] Root of the existing account has MFA; no root access keys exist.
- [ ] AWS Organizations enabled with all features; the existing account is the management account.
- [ ] Member account `backups` created with a plus-addressed root email in the owner's usual inbox.
- [ ] IAM Identity Center enabled in `ap-southeast-1`, one owner user with MFA, assigned to `backups` with administrator access.
- [ ] Centralized root access management enabled for member accounts, and root credentials removed from `backups`, or a note under Comments if it was unavailable.
- [ ] `aws sso login` works locally with a profile named `bookkeeping-backups`; `aws sts get-caller-identity --profile bookkeeping-backups` shows the `backups` account.
- [ ] Railway Postgres service, Backups tab: daily, weekly and monthly schedules enabled; one manual backup taken.
- [ ] The Railway TCP proxy used for the 2026-10-17 manual dump is disabled and `DATABASE_PUBLIC_URL` is gone.
- [ ] The exposed `age` key from 2026-10-17 is replaced, the manual dump re-encrypted with the new key, and the new key stored in two places.

## Comments
