# 04: Freeze committed migrations in CI

Read `../spec.md` first (Freeze).

**What to build:** `pnpm run ci` fails when a change modifies or deletes a
migration file that exists on `main`. New migrations and their snapshots pass,
and the journal may only gain entries.

**Blocked by:** 02 (done)

**Status:** done

**Notes:** Waits for 02 because squashing is allowed until production adopts
the baseline. Part of PR 2.

- [x] A database-free step in `pnpm run ci` compares `packages/database/drizzle/` with `main` and fails on a modified or deleted file, naming it.
- [x] `meta/_journal.json` passes only when its existing entries are unchanged and new ones are appended.
- [x] Works in CI's checkout (fetches `main` if the shallow clone lacks it) without a database service.
- [x] Demonstrated once: an edited baseline and a deleted snapshot fail; an added migration passes. Outputs under Comments, all reverted.
- [x] `pnpm run ci` passes on a clean tree.

## Comments

2026-10-31: `pnpm check:migration-freeze` (the step after
`check:database-migrations` in `pnpm run ci`) runs
`scripts/check-migration-freeze.ts`. It diffs the working tree against
`origin/main`, fetching that ref at depth 1 when the clone lacks it; the
repository is public, so the fetch needs no credentials and `ci.yaml` keeps
its default checkout. The rules live in
`scripts/migration-freeze/migration-freeze.ts`, unit-tested under
`test:scripts`.

Demonstration, each change reverted afterwards:

- Edited baseline (a comment line appended to `0000_baseline.sql`), exit 1:

  ```text
  Committed migrations are frozen: production has applied them.
  Add a new migration instead of changing these files from main:
    packages/database/drizzle/0000_baseline.sql: modified
  ```

- Deleted `meta/0000_snapshot.json`, exit 1:

  ```text
    packages/database/drizzle/meta/0000_snapshot.json: deleted
  ```

- Added migration (a temporary `demo_note` column on `wallets`, generated
  with `drizzle-kit generate --name add_demo_note_to_wallets_table`: a new SQL
  file, a new snapshot and an appended journal entry), exit 0:

  ```text
  Committed migrations match main; new migrations only add.
  ```

- The same added migration with the baseline entry's `when` bumped by 1,
  exit 1:

  ```text
    packages/database/drizzle/meta/_journal.json: entry 0 (0000_baseline) changed
  ```

- A depth-1 clone of the integration branch without `origin/main` fetched it
  from GitHub anonymously and passed.

2026-10-31: Done in 35bfeb7, with review fixes in 7abe7b7 (named
`JournalVersions`, a literal status union that throws on unexpected git
letters). `pnpm run ci` passes.
