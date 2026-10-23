# 07: Keep hand-triggered backups out of `daily/`

Read `../spec.md` first (Object keys, Uploader, Backup job), and
`../../railway-incident-2026-10-21/issues/02-rotate-postgres-password.md`
Comments.

**What to build:** A backup run triggered by hand uploads under its own
`manual/` prefix, so it never adds a version to that Bangkok date's `daily/`
keys. The restore drill refuses a `daily/` key with more than one version,
because that is what a backup planted with a leaked uploader key looks like.

**Blocked by:** none

**Status:** ready-for-human

**Notes:** Railway starts a scheduled run and a hand-triggered run with the same
command, so `backup.sh` tells them apart by the clock. The schedule is
`0 20 * * *` UTC. A run that starts in the 20:00 UTC hour is the nightly run.
Any other run uploads to `manual/<UTC start, YYYY-MM-DDTHHMMSSZ>/` and never to
`monthly/`. The missing-backup alert still lists only `daily/`, so a manual run
cannot hide a missed night. The drill still restores only `daily/`, and
restoring a manual backup belongs to backlog ticket 03.

Update the stack before merging. Until then the uploader cannot write `manual/`,
so a hand-triggered run fails with `AccessDenied`. The nightly run is not
affected.

Two limits follow from the clock rule:

- A hand-triggered run between 20:00 and 20:59 UTC is treated as the nightly
  run, so it collides with the real one. Don't trigger runs in that hour.
- A scheduled run Railway delays past 20:59 UTC lands in `manual/`. The next
  09:00 Bangkok alert then reports the night as missing.

- [x] `backup.sh` picks `daily/` (and `monthly/` on the first) only when the run starts in the 20:00 UTC hour, and otherwise `manual/<UTC start>/`. The clock is read once, when the run starts.
- [x] `infra/aws/backups.yaml`: the uploader may `s3:PutObject` on `manual/*`, and an `expire-manual` lifecycle rule expires it after 35 days. Lints clean with ticket 02's `cfn-lint` command.
- [x] Verified with the job image against a local PostgreSQL 18, with `aws` and `date` stubbed: 20:00:05 UTC on 2026-10-23 → `daily/2026-10-24/`; 20:03 UTC on 2026-10-31 → `daily/2026-11-01/` and `monthly/2026-11/`; 02:49:12, 19:59:59 and 21:00:00 UTC → `manual/<stamp>/` only. `--local-dir` is unchanged.
- [x] Owner: stack updated through a change set whose only direct modifications are `UploaderUser`'s policy and `BackupBucket`'s lifecycle, with no replacement (runbook 05's deploy steps). Resources that reference the bucket's or the alert's ARNs also appear as `Modify`, re-evaluated only.
- [ ] Owner: after the merge redeploys `backup`, one run triggered by hand outside 20:00–20:59 UTC logs `uploaded to manual/…`, and its two objects each have one version.
- [ ] Railway incident ticket 04's "Don't trigger a backup run by hand" note is updated to point here.

## Comments

**2026-10-23 (agent):** The live template matched `HEAD` apart from a trailing
newline, so the change set held only this ticket's edit. Its direct
modifications were `BackupBucket`'s `LifecycleConfiguration` and
`UploaderUser`'s `Policies`. `AlertFunction`, `AlertRole`,
`AlertSchedulerRole`, `AlertSchedule` and `BackupBucketPolicy` showed as
`Modify` with `Dynamic` evaluation from `ResourceAttribute` ARNs only. No
entry had `Replacement: True`, and the parameters kept their live values. The
owner executed it, and the stack is `UPDATE_COMPLETE`. The uploader's
`put-backups` policy now lists `daily/*`, `monthly/*` and `manual/*`, and the
bucket has the `expire-manual` rule (`manual/`, 35 days).
