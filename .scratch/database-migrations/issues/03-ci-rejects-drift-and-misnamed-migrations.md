# 03: CI rejects schema drift and misnamed migrations

Read `../spec.md` first.

**What to build:** `pnpm run ci` fails when someone changes the Drizzle tables
without generating a migration, when the migration snapshots are inconsistent,
or when a migration file breaks the naming shape. The check needs no database,
so it runs locally and in the existing CI job as it is.

**Blocked by:** 01

**Status:** done

- [x] A step in `pnpm run ci` runs `drizzle-kit generate` and fails if the
      working tree gains or changes files under the migrations folder.
- [x] The same step runs `drizzle-kit check` and fails on inconsistent
      snapshots.
- [x] The same step fails if any migration SQL file does not match
      `^\d{4}_[a-z0-9_]+\.sql$`, naming the offending file.
- [x] The CI workflow needs no database service or new job for this.
- [x] Demonstrated once: a schema edit without a migration fails the step, and
      a misnamed file fails the step. The outputs are recorded under Comments
      and both are reverted.
- [x] The conventions section's migration rules gain a line saying CI enforces
      drift and file-name shape, while slug meaning is left to review.
- [x] `pnpm run ci` passes on a clean tree.

## Comments

Implemented in commit `d92102f`.

The new `check:database-migrations` step runs `drizzle-kit generate
--name ci_drift_check`, checks the migration working tree, validates SQL
filenames, and runs `drizzle-kit check`. It uses no database and is wired into
the existing CI job through `pnpm run ci`.

The required negative demonstrations passed and both probes were reverted:

- A temporary `users` schema column generated `0001_ci_drift_check.sql` and
  snapshot/journal changes, then failed with:

  ```text
  The migration directory is not clean after `drizzle-kit generate`.
  ?? packages/database/drizzle/0001_ci_drift_check.sql
  ?? packages/database/drizzle/meta/0001_snapshot.json
  ```

- A temporary `0000_Baseline.sql` failed with:

  ```text
  Migration SQL filenames must match ^\d{4}_[a-z0-9_]+\.sql$:
    packages/database/drizzle/0000_Baseline.sql
  ```

Verification: `pnpm run ci` passed the migration guard, formatting and linting,
all workspace type checks and tests, and both production builds.
