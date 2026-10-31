# 05: Document how production migrates

Read `../spec.md` first (Authorization, Documentation, Backup before merge).

**What to build:** The docs say how migrations reach production, who
authorizes them, and how to recover from a bad one.

**Blocked by:** 02 (done)

**Status:** ready-for-agent

**Notes:** Part of PR 2. Keep README growth neutral.

- [x] `docs/adr/0014-production-migrations-in-railway-pre-deploy.md` with the options the spec lists as rejected.
- [x] ADR 0009 gains an amendment pointing to 0014.
- [x] `docs/code-conventions.md#database-migrations`: history immutable, compatibility with the previous release, manual backup before merging a migration.
- [x] `.github/pull_request_template.md` with the one backup line.
- [x] `CLAUDE.md` (and `AGENTS.md` if it repeats it): agents never merge a PR that adds a migration; the owner's merge authorizes it.
- [x] `../../production-recovery/runbooks/recover-production.md`: step 8a fixes forward, and a check after restore compares `drizzle.__drizzle_migrations` with the deployed journal before redeploying.

## Comments

2026-10-31: Two deviations from the checklist above.

- The post-restore check that compares `drizzle.__drizzle_migrations` with the
  deployed journal is step 7b of
  `../../production-recovery/runbooks/recover-production-after-swap.md`, not a
  step in `recover-production.md`: adding it there pushed that runbook over its
  5,000-token budget.
- `AGENTS.md` drops the clause about the one-time production adoption, because
  ticket 02 completed the adoption on 2026-10-31.
