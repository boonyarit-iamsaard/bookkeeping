# 03: CI rejects schema drift and misnamed migrations

Read `../spec.md` first.

**What to build:** `pnpm run ci` fails when someone changes the Drizzle tables
without generating a migration, when the migration snapshots are inconsistent,
or when a migration file breaks the naming shape. The check needs no database,
so it runs locally and in the existing CI job as it is.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A step in `pnpm run ci` runs `drizzle-kit generate` and fails if the
      working tree gains or changes files under the migrations folder.
- [ ] The same step runs `drizzle-kit check` and fails on inconsistent
      snapshots.
- [ ] The same step fails if any migration SQL file does not match
      `^\d{4}_[a-z0-9_]+\.sql$`, naming the offending file.
- [ ] The CI workflow needs no database service or new job for this.
- [ ] Demonstrated once: a schema edit without a migration fails the step, and
      a misnamed file fails the step. The outputs are recorded under Comments
      and both are reverted.
- [ ] The conventions section's migration rules gain a line saying CI enforces
      drift and file-name shape, while slug meaning is left to review.
- [ ] `pnpm run ci` passes on a clean tree.

## Comments
