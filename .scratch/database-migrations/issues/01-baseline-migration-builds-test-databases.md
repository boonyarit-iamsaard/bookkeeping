# 01: The baseline migration builds every test database

Read `../spec.md` and `docs/adr/0009-drizzle-migrations-outside-production.md`
first. The owner authorized generating and committing migrations on
2026-09-27; this ticket rewrites the `CLAUDE.md` rule that still forbids it.

**What to build:** The schema history starts. The committed `0000_baseline`
migration holds the whole current schema, and every test database (package
suites, the server suite, and the browser suite's API server) is built by
applying the committed migrations instead of `db:push --force`. The owner can
bring a local database up to date with `db:migrate`. Agents and the owner find
the migration rules in the code conventions, and `CLAUDE.md` no longer forbids
migrations.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Drizzle config writes migrations into a folder inside the database
      package with the default `index` prefix, and validates `DATABASE_URL`
      only for commands that connect (`push`, `migrate`, `studio`), so
      `generate` and `check` run without it.
- [ ] `0000_baseline` is generated with `--name baseline` and holds the full
      current schema: enums, `uuidv7()` defaults, partial and expression
      unique indexes, and CHECK constraints. Its SQL is reviewed, not edited.
- [ ] `@bookkeeping/database` exports `migrateDatabase(url)`, which opens its
      own connection, applies pending migrations from the committed folder with
      drizzle-orm's node-postgres migrator, and closes the connection even on
      failure.
- [ ] `startTestDatabase()` calls `migrateDatabase` directly instead of
      starting a `pnpm` child process. Its consumers are unchanged.
- [ ] Root `db:migrate` delegates to the database package, as `db:push` does.
- [ ] A new database-package integration test, beside the test-database
      fixture test, shows that a second `migrateDatabase` run on a migrated
      database succeeds and leaves the schema usable.
- [ ] `docs/code-conventions.md` gains a `## Database migrations` section:
      generate with `--name` in snake_case; Laravel-style slugs for one table
      (`create_<table>_table`, `add_<column>_to_<table>_table`,
      `drop_<column>_from_<table>_table`, `alter_<table>_table_<change>`),
      intent slugs for several, with examples of both; one intent per
      migration; never commit Drizzle's random names; when `generate` asks
      about a rename, stop and give the owner the exact command to run on the
      host; forward-only; squashing allowed until production applies
      migrations, forbidden after; `db:push` only for experiments on a
      throwaway database, with the migration generated before committing.
- [ ] The `CLAUDE.md` "Database schema changes" section says schema changes
      ship as migrations everywhere except production, that applying them to
      production waits for the owner's authorization, and points at the new
      conventions section.
- [ ] The package and server suites pass, `pnpm run ci` passes, and one
      focused SPA spec passes on one project (the browser suite's API
      database changed source). Respect the local resource limits.

## Comments
