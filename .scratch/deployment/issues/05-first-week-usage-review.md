# 05: Review the first week of the trial

Read `../spec.md` and `docs/adr/0008-railway-single-hosting-provider.md` first.

**What to check:** The two assumptions ADR 0008 chose Railway on: the trial
fits the $10 monthly budget, and the first save after idle stays quick.
Neither shows up on deploy day; setup builds inflate that day's usage, and the
phone trial had no idle gap.

**Blocked by:** 04

**Status:** ready-for-human

**Notes:** Due around 2026-10-04, one week after the first deploy. Usage is
under **Workspace → Usage** in Railway. Time the first save after a real idle
gap, such as the first capture of the morning.

- [ ] Railway usage for the week noted under Comments, against the $10 budget.
- [ ] First-save-after-idle latency noted under Comments.
- [ ] If either misses, a follow-up names what to revisit in ADR 0008: plan, app sleeping, or the database.

**Next:** Closing this ticket unblocks the rest of milestone one, which will
have its own spec under `.scratch/real-data-readiness/`, written by grilling
once the hosting choice is confirmed. Agreed scope on 2026-09-27: automated
backups stored off the hosting provider, a restore drill into a fresh
database, applying migrations to production, and wiping the trial data
before the real ledger starts. The switch from `db:push` to migrations
outside production is `.scratch/database-migrations/spec.md` and does not
wait for this ticket; production's share is wiping the trial database,
squashing to one baseline, deciding where migrations run, and freezing
committed migrations (ADR 0009).
