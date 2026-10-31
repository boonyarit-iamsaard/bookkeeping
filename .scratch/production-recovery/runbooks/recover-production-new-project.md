# Runbook: Recover production on a new Railway project

- **Source:** `.scratch/production-recovery/issues/02-recovery-runbook.md`.
  Part of [recover-production.md](recover-production.md); read its
  prerequisites and decisions first.

Every identifier below is a placeholder. Substitute the real value on screen;
never write it into this file. The repository is public.

Step numbers without an N refer to
[recover-production.md](recover-production.md) (steps 1 to 7) and
[recover-production-after-swap.md](recover-production-after-swap.md)
(steps 8 to 13).

For losing the Railway account (ADR 0008). There is no damaged database, so
steps 2, 4, 6, 7, 11 and 13 don't apply, and nothing needs the 20:00 UTC
window until the `backup` service exists. Rebuild everything else from your
own records: images come from the repository.

The ticket lists the rebuild before the restore. This section restores first
(N4) and rebuilds after (N5), so that no `api` can start against an empty
database or write before the restore has passed.

## Steps

### N1. Create the project and an empty Postgres

- [ ] **Done** (tick once Verify passes)
- **Goal:** A new project with one Postgres 18 in Singapore, and nothing
  deployed yet.
- **Why:** The database is restored before the API can write to it.
- **Where:** The Railway dashboard.
- **Do:**
  1. Follow `.scratch/deployment/railway-runbook.md` stages 1 and 2.
  2. Name the Postgres service `database`.
  3. Run `railway link` to the new project.
- **Expect:** One `database` service, `Online`.
- **Verify:** I run `railway service list` and
  `railway variable list --service database --json | jq -r .PGDATABASE`,
  which prints `railway`.
- **Undo:** Delete the project.
- **Ticks:** Nothing directly.
- **Source:** `.scratch/deployment/railway-runbook.md`

### N2. Open the TCP proxy and read the URL

- [ ] **Done** (tick once Verify passes)
- Follow steps 3a and 3b on the new `database` service.

### N3. Drop the empty `railway` database

- [ ] **Done** (tick once Verify passes)
- **Goal:** No database named `railway`, so `restore.sh` can create it.
- **Why:** The template creates `railway` empty, and `restore.sh` refuses a
  database that exists.
- **Where:** `psql` on the `postgres` database, as in step 6.
- **Do:**
  1. Check it is empty:

     ```sql
     \c railway
     SELECT count(*) FROM pg_tables WHERE schemaname = 'public';
     \c postgres
     ```

  2. Only if the count is `0`: `DROP DATABASE railway;`, then `\q`.
- **Expect:** `0`, then `DROP DATABASE`.
- **Verify:** Paste the count.
- **Undo:** Not needed: the database was empty, and
  `CREATE DATABASE railway;` makes another empty one.
- **Ticks:** Nothing directly.
- **Source:** <https://www.postgresql.org/docs/18/sql-dropdatabase.html>

### N4. Restore into `railway`

- [ ] **Done** (tick once Verify passes)
- **Goal:** `railway` is the backup, matching its manifest.
- **Why:** The restore checks the manifest itself, so step 7a doesn't apply.
- **Where:** This machine's terminal.
- **Do:**
  1. Choose the backup with step 1's sub-steps 2 to 4.
  2. Run:

     ```bash
     ( printf 'DATABASE_PUBLIC_URL: '; read -rs u; printf '\n'
       TARGET_DATABASE_URL="${u%/railway}/railway?sslmode=require" \
         apps/backup/restore.sh --identity <AGE_IDENTITY_FILE> --backup <BACKUP_PREFIX> )
     ```

  3. Run [step 7b](recover-production-after-swap.md#7b-compare-the-migrations-table-with-the-journal)'s
     check with `origin/main` as `<REF>`: N5 deploys it.

- **Expect:** `created the database railway`, then
  `passed: <N> tables match, dumped at <DUMPED_AT>, from <BACKUP_PREFIX>/`.
- **Verify:** Paste the last line, and step 7b's lists.
- **Undo:** Run N3 again, then retry.
- **Ticks:** Nothing directly.
- **Source:** `apps/backup/README.md` (Restore)

### N5. Rebuild the services, variables and domains

- [ ] **Done** (tick once Verify passes)
- **Goal:** `api`, `web` and `backup` run as before, against the restored
  database.
- **Why:** Railway holds only the database now. Images rebuild from the
  repository, and variables come from your records.
- **Where:** The Railway dashboard, Hostinger hPanel and the AWS CLI, as each
  runbook below says.
- **Do:**
  1. `api`, `web`, domains and DNS: the deployment runbook's stages 3 to 9.
     Its stage 4 sets `DATABASE_URL=${{database.DATABASE_URL}}`, which needs
     the service named `database`, as N1 does.
  2. Skip its stage 10: the restore already holds the schema, and `db:push`
     must not run. Sign-up stays closed, as stage 11 left it.
  3. `backup`: `.scratch/production-backups/runbooks/03-deploy-storage-and-uploader-key.md`,
     from the step that creates the service, with `DATABASE_URL` as
     `${{database.DATABASE_URL}}`. The S3 stack and bucket are in AWS and
     survive the Railway account; if the uploader key is lost, issue a new
     one as that runbook does.
- **Expect:** `api` passes `/health` on `<API_HOSTNAME>`.
- **Verify:** I run `railway service list` and the `/health` check from
  step 9.
- **Undo:** Not needed.
- **Ticks:** Nothing directly.
- **Source:** `.scratch/deployment/railway-runbook.md`,
  `.scratch/production-backups/runbooks/03-deploy-storage-and-uploader-key.md`,
  <https://docs.railway.com/databases/postgresql> (reference variables)

### N6. Finish

- [ ] **Done** (tick once Verify passes)
- Do steps 9, 10 and 12, then the
  [final checks](recover-production-after-swap.md#final-checks). Skip the checks about
  `railway_damaged` and the local dump.
