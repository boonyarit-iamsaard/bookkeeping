# Runbook: Recover production from a backup

- **Source:** `.scratch/production-recovery/issues/02-recovery-runbook.md`.
  Read `../spec.md` first (Targets, Access, Recovery procedure).
- **Docs checked:** 2026-10-24. Railway CLI 5.71.0; the `down`, `redeploy`,
  `cron run`, `ssh` and `variable list` flags were checked against the
  installed CLI's `--help` as well as the pages cited.
- **Run log:** in
  [recover-production-after-swap.md](recover-production-after-swap.md#run-log).
- **Expected duration:** about 30 minutes hands-on on the same database. The
  rehearsal on 2026-10-24 took 22 minutes for steps 1 to 13 by step 8b,
  without re-entering salvage or step 12. Add the CI run for step 8a and the
  time to re-enter what step 11 finds. After losing the account, allow a few
  days.
- **Estimated cost:** nothing measurable. The TCP proxy bills network egress,
  and the dump is tens of KB.

Every identifier below is a placeholder. Substitute the real value on screen;
never write it into this file. The repository is public.

You run every step. I check only read-only: `railway service list`,
`railway variable list` filtered to key names, `railway cron list`, `curl`,
and S3 listings. Database checks are output you paste back, never a URL.

## Which section to follow

- **The same Railway Postgres**, after a bad migration or corrupted data:
  steps 1 to 7a here, then steps 7b to 13 and the final checks in
  [recover-production-after-swap.md](recover-production-after-swap.md).
- **A new Railway project**, after losing the account:
  [recover-production-new-project.md](recover-production-new-project.md),
  then the final checks.

To rehearse, link the temporary project first
(`railway link --project <TEMP_PROJECT> --environment production`) and
check `railway status` names it: the repository stays linked to production
otherwise. Its `api` is a placeholder image such as `traefik/whoami` with a
generated domain, and its `railway` holds a backup newer than the one you
restore, so step 11 finds real rows; don't re-enter them. The rehearsal
takes step 8b, never 8a: merging a fix would change the real `main` and
redeploy production. It has no `backup` service, so it skips step 12 and
that final check. Deleting the project afterwards only schedules it; Railway
removes it two days later. Link production again when done.

## Prerequisites

- [ ] A terminal at the repository root on an up-to-date `main`, in zsh or
      bash. Every command below works in both.
- [ ] Docker running. `psql`, `pg_dump` and `pg_restore` come from the backup
      job's pinned `postgres:18-alpine` image, so no local PostgreSQL client
      is needed.
- [ ] `age`, the AWS CLI v2, `jq`, `gh`, and the Railway CLI 5.71 or later,
      logged in (`railway whoami`) and linked to the production project
      (`railway status`).
- [ ] A Railway SSH key registered (`railway ssh keys list`), for steps 11
      and 13.
- [ ] Your `age` identity file, `<AGE_IDENTITY_FILE>`. It never leaves this
      machine.
- [ ] Your phone, for step 9.
- Services in production: `api`, `web`, `database` (Postgres 18) and
  `backup` (cron, `0 20 * * *` UTC). Production's database is named
  `railway`, confirmed on 2026-10-24 from the `database` service's
  `PGDATABASE`.
- AWS: profile `bookkeeping-backups`, region `ap-southeast-1`, stack
  `bookkeeping-backups`. The SSO session lasts one hour; log in again with
  `aws sso login --sso-session bookkeeping` if step 5 or 7 says
  `run aws sso login first`.

## Decisions

| Fork                                          | Choice                                                                         | Why                                                                                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How to stop writes                            | Remove the API's active deployment (step 2)                                    | The spec's choice. Nothing else writes to the database, and a later deploy brings it back.                                                                                        |
| Where to dump, restore and check              | Through a temporary TCP proxy, on this machine                                 | ADR 0013's recovery amendment: the private key stays here.                                                                                                                        |
| Salvage and dropping `railway_damaged`        | Inside the `database` container through `railway ssh`, after the proxy is gone | Steps 11 and 13 follow step 10 in the spec, so the proxy is closed by then. These are text queries; the spec rejected `railway ssh` only for piping a binary dump.                |
| The empty `railway` database on a new project | Check it is empty, drop it, restore into `railway`                             | `restore.sh` refuses a database that exists, and the services' `DATABASE_URL` reference keeps its default name. Chosen by the owner on 2026-10-24.                                |
| The manual backup (step 12)                   | `railway cron run --service backup`                                            | Railway documents a run outside the schedule only through the CLI.                                                                                                                |
| How the URL reaches each command              | Read at a hidden prompt inside a `( … )` subshell, once per command            | The password never outlives the command that uses it, and never reaches shell history or the screen. Pasting it four times is the cost.                                           |
| Undoing a bad migration in code               | Fix forward with a newer migration (step 8a)                                   | ADR 0014 makes committed migrations immutable, and CI rejects a PR that deletes one, so a revert can't remove it. Step 7b says whether the deploy reruns it on the restored data. |
| Order on a new project                        | Restore (N4) before rebuilding the services (N5)                               | The ticket lists the rebuild first. Restoring first means no `api` starts against an empty database or writes before the restore has passed.                                      |

## Steps

### 1. Pick the time, the cause and the backup

- [ ] **Done** (tick once Verify passes)
- **Goal:** You know which backup you are restoring and why, and you start
  outside the backup job's hour.
- **Why:** A nightly run between 20:00 and 20:59 UTC would dump a
  half-recovered database under `daily/`. The cause decides step 8.
- **Where:** This machine's terminal.
- **Do:**
  1. Check that it is not 20:xx UTC: `date -u +%H:%M`. Finish by 19:59 UTC or
     start after 21:00 UTC.
  2. Run `aws sso login --sso-session bookkeeping`.
  3. List the backups:

     ```bash
     bucket="$(aws cloudformation describe-stacks --profile bookkeeping-backups \
       --region ap-southeast-1 --stack-name bookkeeping-backups \
       --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)"
     aws s3 ls "s3://$bucket/" --recursive --profile bookkeeping-backups | grep manifest.json.age
     ```

  4. Choose the newest backup taken before the damage: before the bad
     migration's deploy, or before the corrupting write. Note its prefix as
     `<BACKUP_PREFIX>`, such as `daily/<YYYY-MM-DD>`.
  5. Name the cause: **bad migration** (a deploy changed the schema) or
     **corrupted data** (no code change).
- **Expect:** One `manifest.json.age` per `daily/`, `monthly/` and `manual/`
  prefix.
- **Verify:** Tell me the prefix and the cause. I list the prefix's objects
  and check that it has both files.
- **Undo:** Not needed.
- **Ticks:** Nothing directly.
- **Source:** `apps/backup/README.md` (Restore), `../spec.md` (Recovery
  procedure, step 1).

### 2. Stop the API

- [ ] **Done** (tick once Verify passes)
- **Goal:** The API has no running deployment, so nothing writes to the
  database.
- **Why:** A write during steps 4 to 6 would be lost between the damaged
  dump and the restored copy.
- **Where:** Railway dashboard → production → `api` → **Deployments** (per
  docs, verify on screen).
- **Do:**
  1. Note the active deployment's commit as `<DEPLOYED_SHA>`, for step 8b.
  2. On the active deployment, open the **⋮** menu and choose **Remove**.
  3. Or from the terminal: `railway down --service api`. Its prompt names the
     project; confirm only if it is the one you mean.
- **Expect:** The deployment shows as removed. `web` stays up and shows
  errors when it calls the API.
- **Verify:** I run `railway service list`, where `api` is no longer
  `Online`, and `curl -s -o /dev/null -w '%{http_code}' https://<API_HOSTNAME>/health`,
  which returns anything but `200`.
- **Undo:** Redeploy it as in step 8b.
- **Ticks:** Nothing directly.
- **Source:** <https://docs.railway.com/deployments/deployment-actions>,
  <https://docs.railway.com/cli/down>

### 3. Open the TCP proxy and read the URL

#### 3a. Open the proxy

- [ ] **Done** (tick once Verify passes)
- **Goal:** The `database` service is reachable from this machine.
- **Why:** The database has no public address. Decryption and `pg_restore`
  run here so the private key stays here (ADR 0013, recovery amendment).
- **Where:** Railway dashboard → `database` → **Settings** → **Networking**
  (per docs, verify on screen).
- **Do:**
  1. Choose **TCP Proxy** (the Postgres guide calls it **Public Access**).
  2. Enter port `5432`.
- **Expect:** A proxy domain and port such as `<PROXY_HOST>:<PROXY_PORT>`.
  The `database` service gains `DATABASE_PUBLIC_URL`.
- **Verify:** I run
  `railway variable list --service database --json | jq 'has("DATABASE_PUBLIC_URL")'`,
  which prints `true`. It prints only that, never the value.
- **Undo:** Step 10.
- **Ticks:** Ticket 03: "proxy".
- **Source:** <https://docs.railway.com/networking/tcp-proxy>,
  <https://docs.railway.com/databases/postgresql>

#### 3b. Read the URL at a hidden prompt

- [ ] **Done** (tick once Verify passes)
- **Goal:** The URL has the expected form, and this terminal holds the pinned
  image that steps 4 to 7 run.
- **Why:** Every command that needs the URL reads it at a hidden prompt inside
  a `( … )` subshell, as in the deployment runbook's stage 10, so it stays out
  of shell history, off the screen, and gone when the command ends. Each
  builds its database's URL by replacing the trailing `/railway`, so that
  ending has to be there.
- **Where:** This terminal. Copy the URL from `database` → **Variables** →
  `DATABASE_PUBLIC_URL` (per docs, verify on screen) whenever a prompt waits
  for it. Nothing echoes when you paste.
- **Do:**
  1. Check the URL's form, without printing it:

     ```bash
     ( printf 'DATABASE_PUBLIC_URL: '; read -rs u; printf '\n'
       base="${u%/railway}"
       [[ "$base" != "$u" && "$base" == postgres*://*@* && "$base" != *\?* ]] &&
         echo url ok )
     ```

  2. Read the pinned image, which is safe to print:

     ```bash
     image="$(sed -n 's/^FROM \(postgres:[^ ]*@sha256:[0-9a-f]*\).*/\1/p' apps/backup/Dockerfile)"
     printf '%s\n' "$image"
     ```

- **Expect:** `url ok`, then `postgres:18-alpine@sha256:…`. No `url ok`
  means the URL doesn't end in `/railway` or has a query string; stop and
  tell me.
- **Verify:** Tell me both lines.
- **Undo:** `unset image`.
- **Ticks:** Nothing directly.
- **Source:** `.scratch/deployment/railway-runbook.md` (stage 10)

### 4. Dump the damaged database, encrypted

- [ ] **Done** (tick once Verify passes)
- **Goal:** An encrypted copy of `railway` as it stands, on this machine.
- **Why:** The swap keeps `railway_damaged` on the server, but this dump
  survives a mistake in step 6 or 13.
- **Where:** The same terminal.
- **Do:**
  1. Derive the public key from your identity file, which asks for its
     passphrase. `age-keygen -y` alone can't read a passphrase-protected
     file. The key is safe to print, and matches the `backup` service's
     `AGE_RECIPIENT`:

     ```bash
     recipient="$(age --decrypt <AGE_IDENTITY_FILE> | age-keygen -y)"
     printf '%s\n' "$recipient"
     ```

  2. Pick a path outside the repository, such as
     `~/recovery/railway_damaged-<YYYYMMDD>.dump.age`, as
     `<DAMAGED_DUMP_FILE>`, and create its folder.
  3. Dump and encrypt in one pipe, so no plaintext touches disk:

     ```bash
     ( set -o pipefail
       printf 'DATABASE_PUBLIC_URL: '; read -rs u; printf '\n'
       DATABASE_URL="${u%/railway}/railway?sslmode=require" docker run --rm \
         --network host --env DATABASE_URL "$image" \
         sh -c 'exec pg_dump --format=custom --dbname="$DATABASE_URL"' |
         age --recipient "$recipient" --output <DAMAGED_DUMP_FILE> &&
         echo dumped )
     ```

  4. Count the `public` tables it holds, as `manifest.sql` does:

     ```bash
     age --decrypt --identity <AGE_IDENTITY_FILE> <DAMAGED_DUMP_FILE> |
       docker run --rm --interactive "$image" pg_restore --list |
       grep -c 'TABLE DATA public '
     ```

- **Expect:** Sub-step 3 prints `dumped`. Sub-step 4 prints the number of
  tables, the same `<N>` that `restore.sh` reports in step 5. After a bad
  migration the count may differ, because the schema did.
- **Verify:** Tell me the count. I check the file's header without a key:
  `head -c 64 <DAMAGED_DUMP_FILE> | head -n 2` starts
  `age-encryption.org/v1`.
- **Undo:** Delete the file, as in step 13.
- **Ticks:** Ticket 03: "damaged-database dump".
- **Source:** <https://www.postgresql.org/docs/18/app-pgrestore.html>
  (`--list`, standard input), `apps/backup/backup.sh` (the same
  `pg_dump --format=custom`)

### 5. Restore the backup into `railway_restored`

- [ ] **Done** (tick once Verify passes)
- **Goal:** A new database, `railway_restored`, beside `railway`, matching
  the backup's manifest.
- **Why:** Production changes only after a restored copy has passed. A failed
  restore leaves `railway` as it was.
- **Where:** The same terminal.
- **Do:**
  1. Run:

     ```bash
     ( printf 'DATABASE_PUBLIC_URL: '; read -rs u; printf '\n'
       TARGET_DATABASE_URL="${u%/railway}/railway_restored?sslmode=require" \
         apps/backup/restore.sh --identity <AGE_IDENTITY_FILE> --backup <BACKUP_PREFIX> )
     ```

  2. Note the `dumped at` time it prints as `<DUMPED_AT>`, for step 11.
- **Expect:** `created the database railway_restored`, then
  `passed: <N> tables match, dumped at <DUMPED_AT>, from <BACKUP_PREFIX>/`.
- **Verify:** Paste the last line. On `already exists`, a failed earlier
  attempt left `railway_restored`; drop it as in this step's Undo and rerun.
  On any `mismatch:` line, stop: nothing in production has changed.
- **Undo:** In the `psql` that step 6's Where opens,
  `DROP DATABASE railway_restored;`.
- **Ticks:** Ticket 03: "`restore.sh`".
- **Source:** `apps/backup/README.md` (Restore)

### 6. Swap the database names

- [ ] **Done** (tick once Verify passes)
- **Goal:** `railway` is the restored copy and `railway_damaged` the old one.
- **Why:** The services' `DATABASE_URL` names `railway`, so the swap changes
  no variable. A database cannot be renamed while it has connections, or
  from inside itself.
- **Where:** `psql` on the `postgres` database, through the proxy:

  ```bash
  ( printf 'DATABASE_PUBLIC_URL: '; read -rs u; printf '\n'
    DATABASE_URL="${u%/railway}/postgres?sslmode=require" docker run --rm -it \
      --network host --env DATABASE_URL "$image" sh -c 'exec psql "$DATABASE_URL"' )
  ```

- **Do:**
  1. Check nothing else is connected:

     ```sql
     SELECT datname, pid, usename, application_name, backend_start
     FROM pg_stat_activity
     WHERE datname IN ('railway', 'railway_restored') AND pid <> pg_backend_pid();
     ```

  2. If rows remain with the API removed, end them:

     ```sql
     SELECT pg_terminate_backend(pid, 5000) FROM pg_stat_activity
     WHERE datname IN ('railway', 'railway_restored') AND pid <> pg_backend_pid();
     ```

  3. Rename, one statement at a time:

     ```sql
     ALTER DATABASE railway RENAME TO railway_damaged;
     ALTER DATABASE railway_restored RENAME TO railway;
     ```

  4. List them: `SELECT datname FROM pg_database ORDER BY datname;`, then
     `\q`.
- **Expect:** `ALTER DATABASE` twice. The list holds `postgres`, `railway`,
  `railway_damaged` and the templates, and no `railway_restored`. On
  `is being accessed by other users`, repeat sub-steps 1 to 3.
- **Verify:** Paste the list.
- **Undo:** The reversal, in the same `psql`, with the API still removed:

  ```sql
  ALTER DATABASE railway RENAME TO railway_restored;
  ALTER DATABASE railway_damaged RENAME TO railway;
  ```

  If only the first rename ran, run only
  `ALTER DATABASE railway_damaged RENAME TO railway;`.

- **Ticks:** Ticket 03: "swap".
- **Source:** <https://www.postgresql.org/docs/18/sql-alterdatabase.html>,
  <https://www.postgresql.org/docs/18/functions-admin.html>

### 7a. Check `railway` against the manifest

- [ ] **Done** (tick once Verify passes)
- **Goal:** Proof that the database the services will use is the restored
  copy, unchanged.
- **Why:** It catches a swap that went the wrong way before the API writes
  to it.
- **Where:** The same terminal.
- **Do:**
  1. Run:

     ```bash
     ( printf 'DATABASE_PUBLIC_URL: '; read -rs u; printf '\n'
       TARGET_DATABASE_URL="${u%/railway}/railway?sslmode=require" \
         apps/backup/restore.sh --identity <AGE_IDENTITY_FILE> --backup <BACKUP_PREFIX> --check )
     ```

- **Expect:**
  `passed: <N> tables match, dumped at <DUMPED_AT>, from <BACKUP_PREFIX>/`,
  with no `created the database` line.
- **Verify:** Paste the last line. On a mismatch, run step 6's undo, and stop.
- **Undo:** Step 6's undo.
- **Ticks:** Ticket 03: "`--check`".
- **Source:** `apps/backup/README.md` (Restore)

Next: step 7b in
[recover-production-after-swap.md](recover-production-after-swap.md).
