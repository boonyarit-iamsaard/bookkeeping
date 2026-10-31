# 04: Freeze committed migrations in CI

Read `../spec.md` first (Freeze).

**What to build:** `pnpm run ci` fails when a change modifies or deletes a
migration file that exists on `main`. New migrations and their snapshots pass,
and the journal may only gain entries.

**Blocked by:** 02 (done)

**Status:** ready-for-agent

**Notes:** Waits for 02 because squashing is allowed until production adopts
the baseline. Part of PR 2.

- [ ] A database-free step in `pnpm run ci` compares `packages/database/drizzle/` with `main` and fails on a modified or deleted file, naming it.
- [ ] `meta/_journal.json` passes only when its existing entries are unchanged and new ones are appended.
- [ ] Works in CI's checkout (fetches `main` if the shallow clone lacks it) without a database service.
- [ ] Demonstrated once: an edited baseline and a deleted snapshot fail; an added migration passes. Outputs under Comments, all reverted.
- [ ] `pnpm run ci` passes on a clean tree.
