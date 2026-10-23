# 03: Rehearse recovery on a temporary Railway project

Read `../spec.md` first (Rehearsal).

**What to build:** The owner follows the recovery runbook once, end to end,
against a temporary Railway project, and the measured time goes into the
runbook. Passing closes this spec and unblocks `production-migrations`.

**Blocked by:** 02

**Status:** ready-for-human

**Notes:** Only the owner holds the private key and the S3 read access. The
real ledger sits in the temporary project only until it is deleted.

- [ ] A temporary Railway project with one Postgres, loaded so the runbook has a damaged database to swap out, and one placeholder service standing in for the API.
- [ ] The runbook followed end to end with a real S3 backup: proxy, damaged-database dump, `restore.sh`, swap, `--check`, deploy, proxy removed.
- [ ] Any step that didn't match reality is corrected in the runbook.
- [ ] The temporary project and the local dump deleted.
- [ ] The date, the backup restored and the hands-on time recorded under the spec's Comments, and the time written into the runbook as the expected duration.
- [ ] Spec status set to `done`, and `production-migrations` unblocked.

## Comments
