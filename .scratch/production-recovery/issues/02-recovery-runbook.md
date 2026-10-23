# 02: Write the recovery runbook

Read `../spec.md` first (Targets, Access, Recovery procedure).

**What to build:** A runbook the owner follows to recover production from a
backup, on the same Railway Postgres or on a new Railway project.

**Blocked by:** 01

**Status:** ready-for-agent

**Notes:** The agent writes it with `/runbook`, checking Railway's current
documentation for the TCP proxy, removing a deployment and redeploying. The
owner executes it; the agent only checks read-only.

- [ ] Saved as `../runbooks/recover-production.md`.
- [ ] Covers every step of the spec's Recovery procedure in order, with exact commands, including the encrypted `pg_dump` of the damaged database and the two `ALTER DATABASE … RENAME` statements and their reversal.
- [ ] Confirms production's database name, assumed to be `railway`, and uses the confirmed name.
- [ ] Database URLs are read at hidden prompts, as in the deployment runbook's stage 10.
- [ ] Separates the two causes at the deploy step: merge the revert after a bad migration, redeploy the current deployment after corrupted data.
- [ ] A section for a new Railway project after losing the account: create an empty Postgres, rebuild from the owner's records, then restore without the swap.
- [ ] Ends with checks: the manifest matches, `/health` returns 200, the proxy is gone, a `manual/` backup was written, `railway_damaged` and the local dump are deleted.
- [ ] A place for the rehearsal's measured time as the expected duration.

## Comments
