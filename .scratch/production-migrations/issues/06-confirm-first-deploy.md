# 06: Confirm the first deploy migrates

Read `../spec.md` first (Further Notes).

**What to check:** After PR 2 merges, the first `api` deploy's pre-deploy log
shows the migrator connecting to production and applying nothing.

**Blocked by:** 03, 04, 05

**Status:** done

**Notes:** A `CREATE TABLE … already exists` failure here means adoption did
not take; the old version keeps serving. The first real migration later gets a
one-line note under Comments confirming it applied.

- [x] Pre-deploy log of the first deploy after PR 2 noted under Comments.
- [x] The deploy went live and `/health` answers.
- [x] Spec status set to `done`.

## Comments

2026-10-31: PR #66 merged as 8fd261c at 04:12 UTC; its `api` deploy
(`d45bedec`) went live without the pre-deploy step, then the owner ran
`railway config plan` (one change: `api deploy.preDeployCommand (null →
["node dist/migrate.js"])`) and `railway config apply`. The apply redeployed
`api` as `bdcb802d`, whose log reads:

```text
Starting Container
Migrations are up to date.
Starting Container
Server listening on http://0.0.0.0:8080
```

The first container is the pre-deploy (`apps/server/src/migrate-cli.ts`
prints that line after `migrateDatabase` applies nothing). The deploy went
live and `/health` answered 200. A follow-up `railway config plan` reports
the configuration up to date.
