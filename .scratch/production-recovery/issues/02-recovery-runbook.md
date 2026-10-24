# 02: Write the recovery runbook

Read `../spec.md` first (Targets, Access, Recovery procedure).

**What to build:** A runbook the owner follows to recover production from a
backup, on the same Railway Postgres or on a new Railway project.

**Blocked by:** 01

**Status:** ready-for-agent

**Notes:** The agent writes it with `/runbook`, checking Railway's current
documentation for the TCP proxy, removing a deployment and redeploying. The
owner executes it; the agent only checks read-only.

- [x] Saved as `../runbooks/recover-production.md`.
- [x] Covers every step of the spec's Recovery procedure in order, with exact commands, including the encrypted `pg_dump` of the damaged database and the two `ALTER DATABASE … RENAME` statements and their reversal.
- [x] Confirms production's database name, assumed to be `railway`, and uses the confirmed name.
- [x] Database URLs are read at hidden prompts, as in the deployment runbook's stage 10.
- [x] Separates the two causes at the deploy step: merge the revert after a bad migration, redeploy the current deployment after corrupted data.
- [x] A section for a new Railway project after losing the account: create an empty Postgres, rebuild from the owner's records, then restore without the swap.
- [x] Ends with checks: the manifest matches, `/health` returns 200, the proxy is gone, a `manual/` backup was written, `railway_damaged` and the local dump are deleted.
- [x] A place for the rehearsal's measured time as the expected duration.

## Comments

### 2026-10-24

- Production's database name is `railway`, read from the `database`
  service's `PGDATABASE`. The Postgres service is named `database`, not
  `Postgres`.
- Steps 11 (salvage) and 13 (drop `railway_damaged`) follow the proxy's
  removal in the spec, so they run `psql` inside the `database` container
  through `railway ssh` instead. That path is unproven; the rehearsal proves
  it or falls back to reopening the proxy.
- On a new project, the template's empty `railway` database is checked
  empty and dropped, then `restore.sh` restores into `railway` (owner's
  choice).
- The rehearsal must take step 8b, never 8a, because a revert would change
  the real `main`. It has no `backup` service, so it also skips step 12. The
  runbook says both.
- The runbook is split in three to stay within the 5,000-token file limit
  (owner's choice): `recover-production.md` (steps 1–7),
  `recover-production-after-swap.md` (steps 8–13, final checks, run log) and
  `recover-production-new-project.md`.
