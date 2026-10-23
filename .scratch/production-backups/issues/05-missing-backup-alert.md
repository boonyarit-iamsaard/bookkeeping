# 05: Email the owner when a backup is missing

Read `../spec.md` first (Missing-backup alert, Testing Decisions).

**What to build:** Every morning at 09:00 Asia/Bangkok, an AWS-side check
emails the owner if the newest nightly backup is more than 26 hours old, and
a broken checker also sends an email.

**Blocked by:** 04

**Status:** done

**Notes:** The agent extends the template from 02; the owner redeploys it and
confirms the email subscription.

- [x] `infra/aws/backups.yaml` gains an SNS topic with the owner's email subscription, an inline Python Lambda, an EventBridge Scheduler schedule at `cron(0 9 * * ? *)` in `Asia/Bangkok`, and a CloudWatch alarm on the Lambda's `Errors` metric publishing to the topic.
- [x] The Lambda's role may only list the `daily/` prefix of the bucket, publish to the topic, and write its own logs. Its log group keeps 30 days.
- [x] The age threshold is a template parameter defaulting to 26 hours.
- [x] Lints clean with the same `cfn-lint` command as 02.
- [x] Owner: stack updated, SNS subscription confirmed.
- [x] Owner: the alert proven by redeploying with a threshold of 1 hour and invoking the Lambda, or by waiting for a stale backup; the email arrived; the threshold restored to 26 hours.

## Comments

### 2026-10-19: Template written and checked

`infra/aws/backups.yaml` now has the alert: an SNS topic with the owner's
email subscription, an inline Python 3.13 Lambda that lists `daily/` and
publishes when the newest object is more than `BackupMaxAgeHours` old (default
26; a backup exactly that old does not alert), an EventBridge Scheduler schedule at `cron(0 9 * * ? *)` in
`Asia/Bangkok`, and a CloudWatch alarm on the Lambda's `Errors` metric that
publishes to the same topic. The log group keeps 30 days.

The Lambda role may list only the `daily/` prefix, publish to the topic, and
write its own log streams. The scheduler role may only invoke the function.

Checks: the handler's age decision was tested with boto3 stubbed, against the
code extracted from the template, eight cases covering a missing backup, the
threshold boundary, a fractional threshold, the newest object across pages,
the prefix, and a listing failure that must raise. `cfn-lint` (the command
under ticket 02) exits 0.

Review found one defect, fixed: the parameter is a `Number`, so `26.5` was
accepted, and `int()` in the handler crashed on it. The handler now reads it
with `float()`, with a test for a fractional threshold. A failure that
prevents the scheduler from invoking the function (a permission or schedule
fault) produces no Errors datapoint, so this alarm cannot see it. The spec
names the Errors alarm as the check, so this is a known limit, not added here.

The two owner items stay open: deploy the stack and confirm the subscription,
then prove the alert by setting the threshold to 1 hour, invoking the Lambda,
and restoring 26.

### 2026-10-21: Deployed and proven

The owner followed `runbooks/05-alert-deploy-and-proof.md`. The stack update
at 14:19 UTC created only the seven alert resources; the bucket, its policy,
the uploader user and the budget were untouched. The owner confirmed the SNS
email subscription at about 14:22 UTC.

The threshold was set to 1 hour at 14:27 UTC. A manual invoke at 14:30 UTC
returned `"stale"` for the newest backup, `2026-10-20T20:04:24+00:00`, and the
email `Bookkeeping backup is missing` arrived at 14:30 UTC. The threshold was
restored to 26 hours at 14:35 UTC, and `MAX_AGE_HOURS` reads `"26"`.

Still to check: the first scheduled run at 02:00 UTC on 2026-10-22 should
appear in the function's log with no email (runbook step 10).

### 2026-10-22: First scheduled run, and closed as done

The schedule invoked the function at 02:00:28 UTC (09:00 Bangkok), and the
log shows a clean run with no error. The newest backup was about six hours
old, so no email was sent, and the owner's inbox is quiet. The errors alarm
is `OK`. Runbook step 10 is recorded.

All acceptance criteria are met. The alert was built in `bcaee45`, and its
deploy and proof were recorded in `182e514`; both merged as `03b5f05` (#42).
