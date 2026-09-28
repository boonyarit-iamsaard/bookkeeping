# 02: `db:fresh` resets a local database, and only a local one

Read `../spec.md` first.

**What to build:** The owner runs `db:fresh` to drop everything in the local
database and rebuild it from the committed migrations, like Laravel's
`migrate:fresh`. It refuses any database not on this machine before opening a
connection, with no way to override, so a `DATABASE_URL` left pointing at the
Railway trial can never be wiped.

**Blocked by:** 01

**Status:** done

- [x] A pure host check accepts only `localhost` and `127.0.0.1` and throws a
      message naming the refused host. Unit tests cover both accepted hosts
      and refuse a Railway-style proxy host, a private-network host, and an IP
      other than loopback.
- [x] `@bookkeeping/database` exports `freshDatabase(url)`: host check first,
      then drop the `public` and `drizzle` schemas, recreate `public`, and
      call `migrateDatabase`.
- [x] Root `db:fresh` delegates to the database package. There is no
      `--force`, `db:reset`, or `db:status`.
- [x] Integration tests (Testcontainers, whose host is local): on a database
      holding committed rows, `freshDatabase` leaves the schema fully migrated
      and those rows gone, and a follow-up insert works. Given a non-local
      host, it rejects without attempting a connection.
- [x] The conventions section's migration rules gain a paragraph on
      `db:fresh`: what it does, and that it only works on localhost.
- [x] The database-package suite and `pnpm run ci` pass.
- [x] The closing note tells the owner to reset their push-built local
      database once with `db:fresh`, since `0000_baseline` fails on it with
      "already exists".

## Comments

Implemented in commit `eaa0b10`.

Verification: the database package suite passed (4 files, 10 tests), the root
`db:fresh` command refused a Railway-style host before opening a connection,
and `pnpm run ci` passed formatting, linting, typechecking, the full test suite,
and both production builds.

Owner follow-up: reset the existing push-built local database once with
`pnpm db:fresh`; otherwise `0000_baseline` will fail there with "already
exists".

Follow-up: a review found that the host check read only the URL authority,
while `pg` lets a `?host=` query parameter override it, so a localhost URL
could still reach a remote database. Commit `35a36ee` resolves the host with
`pg-connection-string`, as `pg` does, and the check now lives in
`src/local-database-url.ts` with its own unit tests for the accepted and
refused hosts.
