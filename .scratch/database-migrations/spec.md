# Database migrations outside production

Status: done

Decided on 2026-09-27 by grilling. The owner authorized the switch from
`db:push` to migrations for every environment except production, as the
`CLAUDE.md` hard rule requires. Read `docs/adr/0009-drizzle-migrations-outside-production.md`
first.

## Problem Statement

Every database gets its schema from `drizzle-kit push`: test containers, CI,
the local Compose database, and the Railway trial. Push compares the live
database with the Drizzle tables and changes it in place, leaving no record of
how the schema got there. That was right while the domain model moved every
week, but real data is next. Before the ledger holds real money, the owner
needs a committed schema history that can rebuild the database from nothing,
proven by every test run, and a safe way to reset a local database without
remembering Docker volume commands.

## Solution

Schema changes become SQL migrations generated from the Drizzle tables and
committed with the code. Tests, CI, and local development build every database
by applying those migrations, so the suite fails when a migration is wrong.
Two root commands serve the owner locally: `db:migrate` applies pending
migrations, and `db:fresh` drops everything and rebuilds from the migrations,
but only against a database on this machine. CI fails when the Drizzle tables
and the committed migrations disagree, or when a migration file breaks the
naming shape. A new section in the code conventions tells agents and the owner
how to name, generate, and hand off migrations. Production is untouched: the
Railway trial keeps receiving `db:push` by hand until the real-data-readiness
work decides how production applies migrations.

## User Stories

1. As the owner, I want schema changes recorded as committed SQL migrations, so that the database's history is reviewable and repeatable.
2. As the owner, I want the migrations to rebuild the whole schema from an empty database, so that production can later be recreated from them alone.
3. As the owner, I want the first migration to hold the entire current schema as a baseline, so that history starts from what the app runs today.
4. As the owner, I want every test database built by applying the committed migrations, so that a broken migration fails the suite instead of a deploy.
5. As the owner, I want the browser suite's API database built the same way, so that there is one path from migrations to a running schema.
6. As the owner, I want one migrator function shared by tests and local commands, so that there is exactly one way migrations get applied.
7. As the owner, I want that function to be what production can call later, so that the production step reuses tested code.
8. As the owner, I want a `db:migrate` command, so that I can bring my local database up to date after pulling.
9. As the owner, I want `db:migrate` to do nothing when no migration is pending, so that running it twice is harmless.
10. As the owner, I want a `db:fresh` command that drops everything and reapplies all migrations, so that I can reset my local database the way `migrate:fresh` does in Laravel.
11. As the owner, I want `db:fresh` to refuse any host other than `localhost` or `127.0.0.1`, so that a stray `DATABASE_URL` pointing at Railway can never wipe the trial database.
12. As the owner, I want that refusal to happen before any connection opens, so that a refused run touches nothing.
13. As the owner, I want no override flag on that guard, so that nobody can talk the command into a remote wipe.
14. As the owner, I want my existing push-built local database reset once with `db:fresh`, so that it joins the migration history cleanly.
15. As the owner, I want `db:push` kept for local experiments on a throwaway database, so that I can try half-formed schema ideas without writing migrations for each.
16. As the owner, I want a schema change generated as a migration before it is committed, so that experiments never leak into history.
17. As the owner, I want CI to fail when the Drizzle tables changed without a matching migration, so that drift cannot reach `main`.
18. As the owner, I want CI to fail when the migration snapshots are inconsistent, so that a hand-edited or conflicting history is caught.
19. As the owner, I want those checks to run without a database, so that they stay in the routine `pnpm run ci` gate.
20. As the owner, I want the Drizzle config to demand `DATABASE_URL` only for commands that talk to a database, so that generating and checking work anywhere.
21. As the owner, I want migration files named with Drizzle's four-digit prefix and a snake_case slug, so that the folder reads in order.
22. As the owner, I want one-table migrations named in Laravel style (`create_<table>_table`, `add_<column>_to_<table>_table`, `drop_<column>_from_<table>_table`, `alter_<table>_table_<change>`), so that a file's effect is clear without opening it.
23. As the owner, I want migrations spanning several tables named after their intent, so that the name never tells half the story.
24. As the owner, I want one intent per migration, so that unrelated changes are generated separately.
25. As the owner, I want Drizzle's random names (such as `wild_hulk`) never committed, so that every name means something.
26. As the owner, I want CI to reject migration files that break the `NNNN_snake_case.sql` shape, so that the mechanical part of the convention enforces itself.
27. As the owner, I want the naming and workflow rules written in the code conventions, so that agents read them before touching the schema.
28. As an agent, I want `CLAUDE.md` to point me at those rules, so that I stop following the old push-only rule.
29. As an agent, when `generate` asks whether a change is a rename, I want to stop and hand the owner the exact command to run on the host, so that no data-losing guess is made in a terminal I cannot answer.
30. As the owner, I want migrations to be forward-only, so that a bad migration is fixed by a newer one instead of untested down scripts.
31. As the owner, I want committed migrations to stay squashable until production applies them, so that the real ledger can start from one clean baseline.
32. As the owner, I want the Railway trial database left on manual `db:push` for now, so that the trial continues while production's approach waits on the hosting review.

## Implementation Decisions

- **Tool.** `drizzle-kit generate` produces plain SQL plus Drizzle's snapshot
  and journal metadata inside the database package. Drizzle stays on the
  current 0.x versions; drizzle-kit is already pinned exactly, and the ORM's
  caret range cannot reach 1.0. A v1 upgrade is separate work, and its
  `drizzle-kit up` converts the folder format.
- **Naming.** Drizzle's default `index` prefix. Every generate passes
  `--name`. The first migration is `0000_baseline`, holding the whole current
  schema including the pgEnums, `uuidv7()` defaults, partial and expression
  unique indexes, and CHECK constraints.
- **Migrator.** `@bookkeeping/database` exports `migrateDatabase(url)`, which
  opens its own connection, applies pending migrations with drizzle-orm's
  node-postgres migrator from the committed folder, and closes. Migrations
  record themselves in Drizzle's default `drizzle` schema.
- **Fresh.** The package also exports `freshDatabase(url)`: it checks the
  host, then drops the `public` and `drizzle` schemas, recreates `public`,
  and calls `migrateDatabase`. The host check is a pure function that accepts
  only `localhost` and `127.0.0.1` and throws with a message naming the
  refused host. No `--force`, no `db:reset`, no `db:status`.
- **Commands.** Root `db:migrate` and `db:fresh` delegate to the database
  package, as `db:push` and `db:studio` already do, and read `DATABASE_URL`
  the same way. `db:push` and `db:studio` remain.
- **Test harness.** `startTestDatabase()` replaces its
  `db:push --force` child process with a direct `migrateDatabase` call. Every
  consumer (the package suites, the server suite, and the browser suite's API
  server) inherits the change unchanged.
- **Config.** The Drizzle config sets the migrations output folder and
  validates `DATABASE_URL` only when a command needs a connection, so
  `generate` and `check` run without one.
- **CI guard.** A database-free step in `pnpm run ci` runs `drizzle-kit
generate` and fails if the working tree gains files, runs `drizzle-kit
check`, and fails if any migration SQL file does not match
  `^\d{4}_[a-z0-9_]+\.sql$`. It must fit the existing CI job without adding
  a database service.
- **Documentation.** `docs/code-conventions.md` gains a
  `## Database migrations` section covering: naming (Laravel verbs for one
  table, intent for several, snake_case, examples of both), one intent per
  migration, the rename hand-off to the host, forward-only, squashing allowed
  until production and forbidden after, `db:push` for local experiments only,
  and `db:fresh` with its localhost guard. The `CLAUDE.md` "Database schema
  changes" section becomes a short rule (migrations everywhere; production
  application out of scope until the owner authorizes it) pointing at that
  section. Other `.scratch` briefs that repeat the old push-only rule are
  history and stay unchanged.

## Testing Decisions

- Good tests here assert what an owner or a test run observes: a database
  built from migrations works, a reset leaves an empty migrated schema, a
  remote host is refused. They do not assert migration table rows, SQL text,
  or which Drizzle function was called.
- **Main seam: the existing suite.** Once `startTestDatabase()` applies
  migrations, every integration and contract test proves the migrations build
  the schema the code expects. No test is added for that.
- **One new integration file in the database package**, beside the existing
  test-database fixture test (its prior art), using a Testcontainers database
  of its own:
  - `migrateDatabase` run a second time succeeds and changes nothing.
  - `freshDatabase` on a database holding committed rows leaves the schema
    fully migrated and those rows gone, and a follow-up insert works.
  - `freshDatabase` given a non-local host rejects without connecting (a URL
    for an unreachable host is enough to show no connection is attempted).
- **Host check** gets plain unit tests: `localhost` and `127.0.0.1` accepted;
  a Railway-style proxy host, a private-network host, and an IP other than
  loopback refused.
- **CI guard** has no automated test. The implementer demonstrates it once by
  running it against a deliberate schema edit without a migration and against
  a misnamed file, records the outputs in the ticket's closing note, and
  reverts both.
- Run the relevant package and server suites plus `pnpm run ci`. Run one
  focused SPA spec on one project, since the browser suite's API database
  changes source; not the full matrix.

## Out of Scope

- Applying migrations to production: the Railway pre-deploy step or any other
  runner, the trial-data wipe, the squash to a production baseline, and
  freezing committed migrations. These belong to the real-data-readiness spec.
- Backups, restore drills, and anything in ADR 0008's real-data prerequisites
  other than this switch.
- Upgrading Drizzle to v1.
- Down migrations, `db:reset`, `db:status`, and seeding.
- Any schema change beyond the baseline.
- Rewriting historical `.scratch` notes that mention the push-only rule.

## Further Notes

- The Drizzle 0.x migrator applies a migration only if it is newer than the
  last one applied, so a migration merged out of order can be skipped. With
  one developer this is accepted; ADR 0009 records it.
- The owner's local Compose database was built by push and will fail on
  `0000_baseline` with "already exists" until reset once with `db:fresh`.
- Schema experiments with `db:push` should target a throwaway database;
  pushing into the migrated local database leaves it out of step with the
  history until the next `db:fresh`.
