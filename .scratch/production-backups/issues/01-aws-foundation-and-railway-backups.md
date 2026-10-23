# 01: Set up the AWS accounts and Railway's own backups

Read `../spec.md` first (AWS accounts and access, Railway's own backups).

**What to build:** The owner's existing AWS account becomes an Organization's
management account with a dedicated `backups` member account, the owner signs
in through IAM Identity Center with MFA, and Railway's own volume backups run
on the production Postgres service.

**Blocked by:** None (can start immediately)

**Status:** done

**Notes:** Accounts, credentials and MFA are the owner's to handle. An agent
can prepare a step-by-step walkthrough (the `/wizard` skill) but does not
enter credentials.

- [x] Root of the existing account has MFA; no root access keys exist.
- [x] AWS Organizations enabled with all features; the existing account is the management account.
- [x] Member account `backups` created with a plus-addressed root email in the owner's usual inbox.
- [x] IAM Identity Center enabled in `ap-southeast-1`, one owner user with MFA, assigned to `backups` with administrator access.
- [x] Centralized root access management enabled for member accounts, and root credentials removed from `backups`, or a note under Comments if it was unavailable.
- [x] `aws sso login` works locally with a profile named `bookkeeping-backups`; `aws sts get-caller-identity --profile bookkeeping-backups` shows the `backups` account.
- [ ] ~~Railway Postgres service, Backups tab: daily, weekly and monthly schedules enabled; one manual backup taken.~~ Dropped; see Comments.
- [x] The Railway TCP proxy used for the 2026-10-17 manual dump is disabled and `DATABASE_PUBLIC_URL` is gone.
- [x] The exposed `age` key from 2026-10-17 is replaced, the manual dump re-encrypted with the new key, and the new key stored in two places.

## Comments

### 2026-10-18: Railway's own backups dropped

Railway's Backups tab offers creating backups, schedules and point-in-time
recovery only on the Pro plan; on the current plan it can only view, restore
and delete existing ones. The owner chose to stay on Hobby. Railway's own
backups were a faster restore path, not the ADR 0008 requirement, which the
off-Railway job in tickets 02 to 06 meets. Until ticket 04 ships, the
re-encrypted 2026-10-17 dump is the only copy outside the volume.

### 2026-10-18: Closed

Done in bb540d6, merged as ab86a12 (#31). Eight criteria pass, verified from
the CLI and the owner's screenshots; the Railway backups criterion is dropped,
as noted above. The runbook's Run log,
`../runbooks/01-aws-foundation-and-railway-backups.md`, records each step and
the deviations from the docs.
