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
Comments). The scheduled runs prove the new key, so finish the first step
before 20:00 UTC.

- [ ] A second key is created for the uploader user and sealed into the backup service's AWS variables; backup is redeployed.
- [ ] The next scheduled run succeeds, and the key's last-used date shows the new key made the upload.
- [ ] The old key is deactivated, and the following scheduled run succeeds.
- [ ] A week after deactivation, with no failed run, the old key is deleted.
- [ ] The next rotation, October 2027, is recorded under Comments.
