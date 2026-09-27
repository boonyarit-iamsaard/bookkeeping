# 02: `db:fresh` resets a local database, and only a local one

Read `../spec.md` first.

**What to build:** The owner runs `db:fresh` to drop everything in the local
database and rebuild it from the committed migrations, like Laravel's
`migrate:fresh`. It refuses any database not on this machine before opening a
connection, with no way to override, so a `DATABASE_URL` left pointing at the
Railway trial can never be wiped.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A pure host check accepts only `localhost` and `127.0.0.1` and throws a
      message naming the refused host. Unit tests cover both accepted hosts
      and refuse a Railway-style proxy host, a private-network host, and an IP
      other than loopback.
- [ ] `@bookkeeping/database` exports `freshDatabase(url)`: host check first,
      then drop the `public` and `drizzle` schemas, recreate `public`, and
      call `migrateDatabase`.
- [ ] Root `db:fresh` delegates to the database package. There is no
      `--force`, `db:reset`, or `db:status`.
- [ ] Integration tests (Testcontainers, whose host is local): on a database
      holding committed rows, `freshDatabase` leaves the schema fully migrated
      and those rows gone, and a follow-up insert works. Given a non-local
      host, it rejects without attempting a connection.
- [ ] The conventions section's migration rules gain a paragraph on
      `db:fresh`: what it does, and that it only works on localhost.
- [ ] The database-package suite and `pnpm run ci` pass.
- [ ] The closing note tells the owner to reset their push-built local
      database once with `db:fresh`, since `0000_baseline` fails on it with
      "already exists".

## Comments
