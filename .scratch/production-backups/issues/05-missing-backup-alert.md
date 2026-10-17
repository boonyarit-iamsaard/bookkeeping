# 05: Email the owner when a backup is missing

Read `../spec.md` first (Missing-backup alert, Testing Decisions).

**What to build:** Every morning at 09:00 Asia/Bangkok, an AWS-side check
emails the owner if the newest nightly backup is more than 26 hours old, and
a broken checker also sends an email.

**Blocked by:** 04

**Status:** ready-for-agent

**Notes:** The agent extends the template from 02; the owner redeploys it and
confirms the email subscription.

- [ ] `infra/aws/backups.yaml` gains an SNS topic with the owner's email subscription, an inline Python Lambda, an EventBridge Scheduler schedule at `cron(0 9 * * ? *)` in `Asia/Bangkok`, and a CloudWatch alarm on the Lambda's `Errors` metric publishing to the topic.
- [ ] The Lambda's role may only list the `daily/` prefix of the bucket, publish to the topic, and write its own logs. Its log group keeps 30 days.
- [ ] The age threshold is a template parameter defaulting to 26 hours.
- [ ] Lints clean with the same `cfn-lint` command as 02.
- [ ] Owner: stack updated, SNS subscription confirmed.
- [ ] Owner: the alert proven by redeploying with a threshold of 1 hour and invoking the Lambda, or by waiting for a stale backup; the email arrived; the threshold restored to 26 hours.

## Comments
