# Runbook: Recover production, after the swap

- **Source:** `.scratch/production-recovery/issues/02-recovery-runbook.md`.
  Part of [recover-production.md](recover-production.md); read its
  prerequisites and decisions first.

Every identifier below is a placeholder. Substitute the real value on screen;
never write it into this file. The repository is public.

Steps 8 to 13 follow steps 1 to 7 in
[recover-production.md](recover-production.md), which this page's step
numbers refer back to.

## Steps

### 8. Bring the API back

Restored data under a newer API is a second outage, so the deploy depends on
the cause from step 1. Do 8a or 8b, not both.

#### 8a. After a bad migration: merge the revert

- [ ] **Done** (tick once Verify passes)
- **Goal:** `main` no longer holds the migration's code, and Railway deploys
  that.
- **Why:** The restored schema predates the migration. Railway deploys every
  push to `main` once CI passes (ADR 0010).
- **Where:** The repository root.
- **Do:**
  1. Find the squash commit that shipped the migration, `<MIGRATION_SHA>`,
     with `git log --oneline -- packages/database`.
  2. Revert it on a branch. The subject is `revert`, with the scope of the
     one feature the revert touches (such as `revert(wallets):`) or no scope
     if it touches several. The whole subject stays within 72 characters; the
     commit-msg hook names any scope it expects:

     ```bash
     git switch main && git pull --ff-only
     git switch -c revert/<MIGRATION_SLUG>
     git revert --no-commit <MIGRATION_SHA>
     git commit -m "revert(<SCOPE>): <SHORT_SUBJECT>" -m "This reverts commit <MIGRATION_SHA_FULL>."
     ```

  3. `git push -u origin HEAD`, then `gh pr create --fill`.
  4. Wait for the checks with `gh pr checks --watch --required`, then
     `gh pr merge --squash`.
- **Expect:** A new `api` deployment builds from the revert and passes the
  `/health` healthcheck.
- **Verify:** I run `railway service list`: `api` is `Online` with a new
  deployment ID.
- **Undo:** A failed deploy leaves `api` down; fix forward with another PR.
- **Ticks:** Ticket 03: "deploy".
- **Source:** <https://git-scm.com/docs/git-revert> (`--no-commit`),
  <https://cli.github.com/manual/gh_pr_checks> (`--watch`, `--required`),
  `docs/adr/0010-protected-main-and-gated-deploys.md`,
  `commitlint.config.ts`

#### 8b. After corrupted data: redeploy the current deployment

- [ ] **Done** (tick once Verify passes)
- **Goal:** The same build that was running comes back.
- **Why:** The code did not change, so it matches the restored schema.
- **Where:** Railway dashboard → `api` → **Deployments** (per docs, verify
  on screen).
- **Do:**
  1. On the deployment removed in step 2, open **⋮** and choose
     **Redeploy**.
  2. If the menu doesn't offer it: `railway redeploy --service api`. If that
     also refuses, `railway redeploy --service api --from-source` builds the
     newest `main`; first check with `git log -1 origin/main` that it is the
     commit step 2 removed.
- **Expect:** A new deployment passes the `/health` healthcheck.
- **Verify:** I run `railway service list`: `api` is `Online` with a new
  deployment ID.
- **Undo:** Not needed.
- **Ticks:** Ticket 03: "deploy".
- **Source:** <https://docs.railway.com/deployments/deployment-actions>,
  <https://docs.railway.com/cli/redeploy>

### 9. Check the API and sign in

- [ ] **Done** (tick once Verify passes)
- **Goal:** The app works on the restored data.
- **Why:** The healthcheck proves the server started; signing in proves it
  reads the restored users and sessions.
- **Where:** Your phone, on mobile data.
- **Do:**
  1. Open `https://<WEB_HOSTNAME>/` and sign in.
  2. Open a wallet and check its balance against what you expect at
     `<DUMPED_AT>`.
- **Expect:** Sign-in works, and balances match the backup's moment.
- **Verify:** I run
  `curl -s -o /dev/null -w '%{http_code}' https://<API_HOSTNAME>/health`,
  which returns `200`. You tell me the sign-in worked.
- **Undo:** If data looks wrong, remove the API again (step 2) before anyone
  writes, and tell me.
- **Ticks:** Nothing directly.
- **Source:** `apps/server/railway.json` (`healthcheckPath`)

### 10. Remove the TCP proxy

- [ ] **Done** (tick once Verify passes)
- **Goal:** The database is private again.
- **Why:** Outside a recovery nothing is exposed (ADR 0013).
- **Where:** Railway dashboard → `database` → **Settings** → **Networking**
  (per docs, verify on screen). The docs don't name the delete control; the
  deployment runbook's stage 10 deleted it there.
- **Do:**
  1. Delete the TCP proxy.
  2. In the terminal: `unset image`.
- **Expect:** No proxy domain under Networking.
- **Verify:** I run
  `railway variable list --service database --json | jq 'keys | map(select(test("PUBLIC|PROXY")))'`,
  which prints `[]`.
- **Undo:** Step 3a.
- **Ticks:** Ticket 03: "proxy removed".
- **Source:** <https://docs.railway.com/networking/tcp-proxy>

### 11. Salvage what came after the backup

- [ ] **Done** (tick once every listed entry is re-entered)
- **Goal:** Every entry recorded or changed after `<DUMPED_AT>` is entered
  again through the app.
- **Why:** The app keeps balances and change history correct; an automated
  merge would bypass both.
- **Where:** `psql` inside the `database` container, with no proxy needed:
  `railway ssh --service database`, then `psql -U postgres -d railway_damaged`.
- **Do:**
  1. Set the time: `\set dumped_at '<DUMPED_AT>'`
  2. List the transactions recorded after it:

     ```sql
     SELECT t.recorded_at, t.transaction_date, t.type, w.name AS wallet,
       d.name AS destination, c.name AS category, t.amount / 100.0 AS baht,
       t.note, t.deleted_at
     FROM transactions t
     JOIN wallets w ON w.id = t.wallet_id
     LEFT JOIN wallets d ON d.id = t.destination_wallet_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.recorded_at > :'dumped_at'
     ORDER BY t.recorded_at;
     ```

  3. List edits and deletions made after it to older transactions, and wallet
     changes:

     ```sql
     SELECT changed_at, action, before, after FROM transaction_changes
     WHERE changed_at > :'dumped_at' AND transaction_id IN
       (SELECT id FROM transactions WHERE recorded_at <= :'dumped_at')
     ORDER BY changed_at;
     SELECT changed_at, action, before, after FROM wallet_changes
     WHERE changed_at > :'dumped_at' ORDER BY changed_at;
     ```

  4. List wallets and categories created after it. Their `created_at` has no
     time zone and holds the server's UTC time:

     ```sql
     SELECT 'wallet' AS kind, name, created_at FROM wallets
     WHERE created_at > (:'dumped_at'::timestamptz AT TIME ZONE 'UTC')
     UNION ALL
     SELECT 'category', name, created_at FROM categories
     WHERE created_at > (:'dumped_at'::timestamptz AT TIME ZONE 'UTC')
     ORDER BY created_at;
     ```

  5. Enter each one again in the app, oldest first, creating wallets and
     categories before the transactions that use them. Then `\q` and `exit`.
- **Expect:** A few rows; about two transactions a day were recorded when
  ADR 0013 was written. After a bad migration, a column these queries name
  may have changed; adjust the query to the damaged schema.
- **Verify:** Tell me how many entries you re-entered. Don't paste the rows.
- **Undo:** Not needed; `railway_damaged` is untouched.
- **Ticks:** Nothing directly.
- **Source:** <https://docs.railway.com/cli/ssh>,
  `packages/database/src/transactions/transaction.schema.ts`,
  `packages/database/src/wallets/wallet.schema.ts`

### 12. Take a manual backup

- [ ] **Done** (tick once Verify passes)
- **Goal:** A backup of the recovered database, salvaged entries included.
- **Why:** The next nightly backup is hours away. A run outside 20:00–20:59
  UTC writes under `manual/`, never `daily/`.
- **Where:** This machine's terminal. Check `date -u +%H` is not `20`.
- **Do:**
  1. Run `railway cron run --service backup` and confirm.
- **Expect:** The run exits within about a minute, and its log says
  `uploaded to manual/…`.
- **Verify:** I run `railway cron list --service backup --limit 1` and, after
  `aws sso login`, list `manual/` for a prefix newer than the recovery's
  start with both files.
- **Undo:** Not needed. The backup expires after 35 days.
- **Ticks:** Nothing directly.
- **Source:** <https://docs.railway.com/cli/cron>,
  `docs/adr/0013-nightly-encrypted-backups-to-aws-s3.md` (2026-10-23
  amendment)

### 13. Drop `railway_damaged` and delete the local dump

- [ ] **Done** (tick once Verify passes)
- **Goal:** Nothing of the damaged database is left.
- **Why:** It holds the ledger in a state you have now replaced, and the
  local dump is a second copy of your finances on this machine.
- **When:** Only after step 11 is finished and step 12 passed.
- **Where:** `railway ssh --service database`, then
  `psql -U postgres -d postgres`; then this machine's terminal.
- **Do:**
  1. `DROP DATABASE railway_damaged;`
  2. `SELECT datname FROM pg_database ORDER BY datname;`, then `\q` and
     `exit`.
  3. `rm <DAMAGED_DUMP_FILE>`, and the folder if it is empty.
- **Expect:** `DROP DATABASE`, then a list of `postgres`, `railway` and the
  templates only. If the drop says other sessions are using it, quit any
  other `psql` on it and retry.
- **Verify:** Paste the list. `ls <DAMAGED_DUMP_FILE>` says no such file.
- **Undo:** ⚠️ Irreversible. The `railway_damaged` drop cannot be undone, and
  without the local dump nothing of it remains.
- **Ticks:** Ticket 03: "the local dump deleted".
- **Source:** <https://www.postgresql.org/docs/18/sql-dropdatabase.html>

## Final checks

- [ ] The manifest matches: step 7 (or N4) printed `passed`.
- [ ] `/health` returns `200`:
      `curl -s -o /dev/null -w '%{http_code}' https://<API_HOSTNAME>/health`.
- [ ] The proxy is gone: step 10's variable check prints `[]`.
- [ ] A `manual/` backup was written: step 12's listing shows it with both
      files.
- [ ] `railway_damaged` is dropped and the local dump deleted: step 13.
- [ ] The time from step 1 to the last check is written into **Expected
      duration** in [recover-production.md](recover-production.md), and in
      the Run log.

## Run log

### 2026-10-24

- Completed: runbook written. Production's database name confirmed as
  `railway` from `PGDATABASE`; services confirmed as `api`, `web`,
  `database` and `backup`.
- Deviations from docs:
  - Railway's TCP proxy page doesn't say how to delete a proxy, or that it
    adds `DATABASE_PUBLIC_URL`; the Postgres page says enabling it does. The
    deployment runbook's stage 10 deleted it under **Settings** →
    **Networking**, and no `PUBLIC` or `PROXY` variable remains today.
  - The deployment-actions page doesn't say whether a removed deployment can
    be redeployed, so step 8b gives two CLI fallbacks.
  - Railway documents a cron run outside the schedule only through the CLI.
  - `railway ssh` running `psql` in the `database` container (steps 11 and 13) is unproven. Ticket 03's rehearsal proves it, or falls back to
    reopening the proxy for those steps.
