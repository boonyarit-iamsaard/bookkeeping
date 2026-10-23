# 04: Replace the AWS uploader key

Read `../spec.md` first (Impact, Decisions) and the production-backups
ticket 03 runbook, which created the first key.

**What to build:** The nightly backup uploads with a new access key, and the
old key no longer works.

**Blocked by:** 02

**Status:** ready-for-human

**Notes:** Create the new key before deactivating the old one, and deactivate
before deleting, so a broken step can be undone. Paste values with the
console's copy icons, straight into the sealed variables, as in ticket 03.

Don't trigger a backup run by hand. It writes a second version of that
Bangkok date's `daily/` keys, which the restore drill refuses (see ticket 02's
Comments). The one exception, on 2026-10-23, is recorded under Comments.

- [x] A second key is created for the uploader user and sealed into the backup service's AWS variables; backup is redeployed.
- [x] A backup run succeeds, and the key's last-used date shows the new key made the upload.
- [ ] The old key is deactivated, and the following scheduled run succeeds.
- [ ] A week after deactivation, with no failed run, the old key is deleted.
- [ ] The next rotation, October 2027, is recorded under Comments.

## Comments

**2026-10-23, 02:45 UTC (agent):** The owner created a second key for
`bookkeeping-backup-uploader` at 02:39 UTC (`…CTHTTX3P`, never used yet) and
sealed it into backup. Backup deployment `d9cf4334` (`0cd87f9`) reached
`SUCCESS` at 02:42 UTC. `apps/backup` is unchanged from `ab86a12`, the commit
the previous deployment ran. The old key (`…MFTDTPPQ`) is still active. It was
last used by S3 at 02:01 UTC, the manual run in ticket 02. Next: after the
20:00 UTC run on 2026-10-23, confirm the run succeeded and that the new key
made the upload, then deactivate the old key.

**2026-10-23, 02:59 UTC (agent):** To deactivate the old key sooner, the
owner chose one more manual run on `daily/2026-10-23/`, which already had two
versions per key. That folder now has three versions per key: 20:04 UTC on
2026-10-22, then 02:01 and 02:49 UTC on 2026-10-23. Tonight's run writes
`daily/2026-10-24/`, which the drill accepts. The run at 02:49 UTC succeeded
and logged `uploaded to daily/2026-10-23/`. IAM shows the new key
(`…CTHTTX3P`) last used by S3 in ap-southeast-1 at 02:49 UTC. The old key
(`…MFTDTPPQ`) is unchanged at 02:01 UTC, so the new key made the upload. The
old key can be deactivated.
