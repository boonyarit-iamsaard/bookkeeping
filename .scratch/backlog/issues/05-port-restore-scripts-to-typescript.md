# 05: Port the restore scripts from bash to TypeScript

Read `docs/research/backup-scripts-language.md` first (Assessment).

**What to build:** `restore.sh`, `restore-drill.sh` and `restore-common.sh`
become TypeScript that the owner and an average developer can read, with
automated tests for every refusal rule. `backup.sh` stays in bash until a
change forces a port.

**Blocked by:** None. Start after `production-migrations`.

**Status:** wontfix

**Notes:** The research recommends TypeScript over Python and Go, keeping
`pg_dump`, `pg_restore`, `psql`, `age` and the `aws` CLI as subprocesses.
Grill it into a spec first: where the code lives, how it runs, and whether
`--local-dir` survives.

- [ ] Vitest tests that run today's bash restores as black boxes, with a stubbed `aws`, covering ticket 01's manual checks in `../../production-recovery/issues/01-restore-script.md`.
- [ ] The restores ported to TypeScript, passing the same tests unchanged.
- [ ] The owner's drill and a `--check` pass on real backups.
- [ ] The recovery rehearsal repeated, as `../../production-recovery/spec.md` (Rehearsal) requires after a material change to `restore.sh`.

## Comments

### 2026-10-31: deferred until a real change needs it

The bash restores work and were proven by the drill and the recovery
rehearsal, so the owner deferred the port rather than re-prove a working
recovery path. Reopen this ticket, at `needs-triage`, when `restore.sh`,
`restore-drill.sh` or `restore-common.sh` needs a real change, or when reading
them blocks work. Then start from the research's staged plan, stage 1 first.
`apps/backup/README.md` points here so the trigger is seen at the scripts.
