# 06: Confirm the first deploy migrates

Read `../spec.md` first (Further Notes).

**What to check:** After PR 2 merges, the first `api` deploy's pre-deploy log
shows the migrator connecting to production and applying nothing.

**Blocked by:** 03, 04, 05

**Status:** ready-for-human

**Notes:** A `CREATE TABLE … already exists` failure here means adoption did
not take; the old version keeps serving. The first real migration later gets a
one-line note under Comments confirming it applied.

- [ ] Pre-deploy log of the first deploy after PR 2 noted under Comments.
- [ ] The deploy went live and `/health` answers.
- [ ] Spec status set to `done`.
