# 05: Email the owner when a backup is missing

Read `../spec.md` first (Missing-backup alert, Testing Decisions).

**What to build:** Every morning at 09:00 Asia/Bangkok, an AWS-side check
emails the owner if the newest nightly backup is more than 26 hours old, and
a broken checker also sends an email.

**Blocked by:** 04

**Status:** ready-for-human

**Notes:** The agent extends the template from 02; the owner redeploys it and
confirms the email subscription.

- [x] `infra/aws/backups.yaml` gains an SNS topic with the owner's email subscription, an inline Python Lambda, an EventBridge Scheduler schedule at `cron(0 9 * * ? *)` in `Asia/Bangkok`, and a CloudWatch alarm on the Lambda's `Errors` metric publishing to the topic.
- [x] The Lambda's role may only list the `daily/` prefix of the bucket, publish to the topic, and write its own logs. Its log group keeps 30 days.
- [x] The age threshold is a template parameter defaulting to 26 hours.
- [x] Lints clean with the same `cfn-lint` command as 02.
- [ ] Owner: stack updated, SNS subscription confirmed.
- [ ] Owner: the alert proven by redeploying with a threshold of 1 hour and invoking the Lambda, or by waiting for a stale backup; the email arrived; the threshold restored to 26 hours.

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
