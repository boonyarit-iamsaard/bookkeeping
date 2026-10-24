# 03: Rehearse recovery on a temporary Railway project

Read `../spec.md` first (Rehearsal).

**What to build:** The owner follows the recovery runbook once, end to end,
against a temporary Railway project, and the measured time goes into the
runbook. Passing closes this spec and unblocks `production-migrations`.

**Blocked by:** 02

**Status:** done

**Notes:** Only the owner holds the private key and the S3 read access. The
real ledger sits in the temporary project only until it is deleted.

- [x] A temporary Railway project with one Postgres, loaded so the runbook has a damaged database to swap out, and one placeholder service standing in for the API.
- [x] The runbook followed end to end with a real S3 backup: proxy, damaged-database dump, `restore.sh`, swap, `--check`, deploy, proxy removed.
- [x] Any step that didn't match reality is corrected in the runbook.
- [x] The temporary project and the local dump deleted.
- [x] The date, the backup restored and the hands-on time recorded under the spec's Comments, and the time written into the runbook as the expected duration.
- [x] Spec status set to `done`, and `production-migrations` unblocked.

## Comments

### 2026-10-24

Rehearsed against `bookkeeping-recovery-drill`, with `traefik/whoami` as the
placeholder `api` and `railway` loaded from `daily/2026-10-24`. Restored
`daily/2026-10-21` (dumped at 2026-10-20T20:04:20Z) by step 8b; both
manifest checks passed with 10 tables. Hands-on time: 22 minutes, 09:32 to
09:54 UTC. The runbook's run log lists the corrections: step 4's public key,
step 8b's redeploy fallback, and `railway ssh` proven for steps 11 and 13.
Railway scheduled the project's deletion for 2026-10-26; its services are
offline until then. The local dump is deleted.
