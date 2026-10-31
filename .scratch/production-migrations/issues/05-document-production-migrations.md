# 05: Document how production migrates

Read `../spec.md` first (Authorization, Documentation, Backup before merge).

**What to build:** The docs say how migrations reach production, who
authorizes them, and how to recover from a bad one.

**Blocked by:** 02 (done)

**Status:** ready-for-agent

**Notes:** Part of PR 2. Keep README growth neutral.

- [ ] `docs/adr/0014-production-migrations-in-railway-pre-deploy.md` with the options the spec lists as rejected.
- [ ] ADR 0009 gains an amendment pointing to 0014.
- [ ] `docs/code-conventions.md#database-migrations`: history immutable, compatibility with the previous release, manual backup before merging a migration.
- [ ] `.github/pull_request_template.md` with the one backup line.
- [ ] `CLAUDE.md` (and `AGENTS.md` if it repeats it): agents never merge a PR that adds a migration; the owner's merge authorizes it.
- [ ] `../../production-recovery/runbooks/recover-production.md`: step 8a fixes forward, and a check after restore compares `drizzle.__drizzle_migrations` with the deployed journal before redeploying.
