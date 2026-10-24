# Railway incident of 2026-10-21

Status: ready-for-human

Railway's platform outage and security disclosure of 2026-10-21, assessed on
2026-10-22. Read ADR 0008 and ADR 0013 first.

## What happened

- Railway incident `QH8L8B3E` began at 07:24 UTC on 2026-10-21. From about
  09:28 UTC builds and deploys were paused in every region, Southeast Asia
  included, and the dashboard, API, CLI and support site were degraded.
  Dashboard sessions were signed out.
- Builds return by plan: Enterprise, then Pro, then Hobby, then Free. At
  11:47 UTC on 2026-10-22 Pro and Enterprise were building and Hobby was not.
- Railway's security disclosure says a third party "may have accessed
  encrypted environment variables and, for some of them, obtained the
  decrypted contents", and tells every customer to replace all environment
  variables. Railway says the impact may be limited to a subset of users and
  will email them. It does not say whether sealed variables were included.
- The owner received the general disclosure email, which does not say whether
  this account was affected.

## Railway's preliminary report

Published 23:31 UTC on 2026-10-22, updated 2026-10-23. The investigation is
still open, and the status page shows `QH8L8B3E` as Monitoring.

- **Timing:** the attack ran from 13:58 UTC on 2026-10-20 to 03:32 UTC on
  2026-10-22. Decryption of stored variables happened between 07:25 and
  09:18 UTC on 2026-10-21. The backup upload at 20:04 UTC on 2026-10-21 falls
  inside the attack window.
- **Scope:** at most 1.85% of workspaces, about 100,000, had some variables
  decrypted. Railway can't tell which variables, because they were envelope
  encrypted. The attacker sought AI and platform API keys, and Railway rates
  workspaces with many variables or many AI keys as highest risk. User
  accounts were not logged into. Access to source code is not yet ruled out.
- **Sealed variables:** the report doesn't mention them.
- **This account:** Railway finished emailing higher-risk workspaces at
  18:57 UTC on 2026-10-23. The owner received only the general changelog
  email linking the report, not a higher-risk notice. So the account was not
  flagged as higher risk, but Railway says that doesn't mean it is confirmed
  safe. Every secret in the table below was replaced anyway.

## Impact

- **Availability:** none observed. On 2026-10-22 api `/health` and web `/`
  both returned 200. Running containers, Postgres and the `backup` cron kept
  working while builds were paused.
- **Deploys:** #39, #37 and #40 merged to `main` between 09:40 and 10:04 UTC on
  2026-10-21, after builds were paused. All three change files that the api
  and web services watch, so production likely still runs the code from
  before them.
- **Secrets:** treated as leaked, because the account may be affected.

| Secret                                          | Service               | Risk if leaked                                                             |
| ----------------------------------------------- | --------------------- | -------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                            | api                   | High: it signs session cookies for the app that holds the real ledger      |
| Postgres password                               | Postgres, api, backup | Medium: with no TCP proxy, the database can't be reached from the internet |
| AWS uploader key                                | backup (sealed)       | Medium: it can only add objects, but it could plant a fake backup (below)  |
| `AGE_RECIPIENT`, `VITE_API_ORIGIN`, URLs, flags | —                     | None: these are public values                                              |

**Planted backups.** The uploader key can't read or delete, but it can add a
newer version of a `daily/` key. `AGE_RECIPIENT` is public, so anyone holding
the key could encrypt a fake dump with a matching manifest. The restore drill
would restore and pass it, and the missing-backup alert would stay quiet.
S3 uploads are data events, which CloudTrail's event history doesn't record.

## Checks done on 2026-10-22

- **Backup bucket:** one version per key and no delete markers. Each night has
  exactly one dump and one manifest, uploaded around 20:02–20:04 UTC, apart
  from the manual run at 12:55 UTC on 2026-10-18 and the ticket 03 probe. The
  newest backup, `daily/2026-10-22/`, was uploaded at 20:04 UTC on 2026-10-21,
  during the outage. No missing-backup alert email arrived.
- **Uploader key:** one active key, created 2026-10-18 and last used by S3 at
  20:04 UTC on 2026-10-21, which was the backup upload. CloudTrail in every
  region shows a single event for the key since 2026-10-18: the ticket 03
  `GetCallerIdentity` check.
- **GitHub:** every repository event since 2026-10-21 came from the owner,
  Dependabot or CodeRabbit, and there are no unexpected branches. The owner
  found deploy keys, webhooks and the Railway app as expected.

## Decisions

- Change no Railway variable until Hobby deploys return. Railway passes new
  values to a service only when it deploys, and regenerating the Postgres
  password before api and backup can redeploy takes the app down and fails
  that night's backup.
- Replace one secret per redeploy, so that a failure points at one change.
- The restore drill refuses a backup with more than one object version.
  Recorded as a criterion on production-backups ticket 06.
- This uploader key replacement counts as the key's yearly rotation, so the
  next one is due in October 2027.

## Tickets

1. Confirm the queued `main` deploys went live
2. Rotate the Postgres password, blocked by 1
3. Replace `BETTER_AUTH_SECRET`, blocked by 2
4. Replace the AWS uploader key, blocked by 2
5. Close the incident, blocked by 2, 3 and 4

## Sources

- <https://status.railway.com/incident/QH8L8B3E>
- <https://blog.railway.com/p/security-disclosure-wednesday-october-21st>
- <https://blog.railway.com/p/preliminary-report-october-security-incident>
- <https://blog.railway.com/p/security-disclosure-recommendation-rotate-postgresql-database-credentials>
- <https://blog.railway.com/p/security-disclosure-recommendation-check-for-anomalous-aws-access>
