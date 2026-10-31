# Runbook: Adopt production's baseline

- **Source:** `.scratch/production-migrations/issues/02-adopt-production.md`.
  Read `../spec.md` first (Adoption command).
- **Docs checked:** 2026-10-31, against the TCP proxy and manual backup steps
  of `../../production-recovery/runbooks/recover-production.md`, which the
  recovery rehearsal ran on 2026-10-24.
- **Expected duration:** about 15 minutes. Each `db:adopt-baseline` run
  starts a throwaway PostgreSQL container, which takes under a minute.
- **Estimated cost:** nothing measurable. The TCP proxy bills network egress,
  and a schema dump is a few KB.

Every identifier below is a placeholder. Substitute the real value on screen;
never write it into this file. The repository is public.

You run every step, and only after giving the go-ahead to write to
production. I check only read-only: `railway variable list` filtered to key
names, `railway cron list`, and S3 listings. Database results are output you
paste back, never a URL.

## Prerequisites

- [ ] A terminal at the repository root on an up-to-date `main` that holds
      ticket 01 (`git log --oneline -- packages/database/src/adopt-baseline.ts`
      lists it), after `pnpm install`, in zsh or bash.
- [ ] Docker running. `db:adopt-baseline` starts the PostgreSQL image pinned
      in `apps/backup/Dockerfile` and runs `pg_dump` from it; step 5 runs
      `psql` from the same image. No local PostgreSQL client is needed.
- [ ] The Railway CLI, logged in (`railway whoami`) and linked to the
      production project (`railway status`), and `jq`.
- [ ] Nothing deploys to production while you work: no PR merges until step 6.

## Decisions

| Fork                             | Choice                                                              | Why                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| How the URL reaches each command | Read at a hidden prompt inside a `( … )` subshell, once per command | The password never outlives the command that uses it, and never reaches shell history, the screen or a file. Pasting it three times is the cost. |
| The URL's form                   | `DATABASE_PUBLIC_URL` exactly as Railway shows it                   | The 2026-09-27 `db:push` connected with it unchanged, and `db:adopt-baseline` reads `DATABASE_URL` the same way.                                 |
| The restore point                | A manual backup minutes before (step 1)                             | The spec's choice. Adoption writes one schema in one transaction, but the backup is the restore point if anything else goes wrong.               |

## Steps

### 1. Take a manual backup

- [ ] **Done** (tick once Verify passes)
- **Goal:** A backup of production from minutes before adoption.
- **Why:** The nightly backup can be almost a day old. A run outside
  20:00–20:59 UTC writes under `manual/`, never `daily/`.
- **Where:** This terminal. Check `date -u +%H` is not `20`.
- **Do:**
  1. Run `railway cron run --service backup` and confirm.
- **Expect:** The run exits within about a minute, and its log says
  `uploaded to manual/…`.
- **Verify:** Tell me the `manual/<stamp>/` prefix; note it under ticket 02's
  Comments. I run `railway cron list --service backup --limit 1` and, after
  `aws sso login`, list that prefix for both files.
- **Undo:** Not needed. The backup expires after 35 days.
- **Ticks:** Ticket 02: "Manual backup".
- **Source:** <https://docs.railway.com/cli/cron>

### 2. Open the TCP proxy

- [ ] **Done** (tick once Verify passes)
- **Goal:** The `database` service is reachable from this machine.
- **Why:** The database has no public address, and the command runs here.
- **Where:** Railway dashboard → `database` → **Settings** → **Networking**
  (per docs, verify on screen).
- **Do:**
  1. Choose **TCP Proxy** (the Postgres guide calls it **Public Access**).
  2. Enter port `5432`.
- **Expect:** A proxy domain and port. The `database` service gains
  `DATABASE_PUBLIC_URL`.
- **Verify:** I run
  `railway variable list --service database --json | jq 'has("DATABASE_PUBLIC_URL")'`,
  which prints `true`. It prints only that, never the value.
- **Undo:** Step 6.
- **Ticks:** Nothing directly.
- **Source:** <https://docs.railway.com/networking/tcp-proxy>

Whenever a prompt below waits for the URL, copy it from `database` →
**Variables** → `DATABASE_PUBLIC_URL` (per docs, verify on screen). Nothing
echoes when you paste.

### 3. Check the schema

- [ ] **Done** (tick once Verify passes)
- **Goal:** Proof that production's schema matches `0000_baseline` exactly,
  with nothing written.
- **Why:** Adoption records the baseline as applied without running it, so
  every later migration assumes this schema.
- **Where:** This terminal.
- **Do:**

  ```bash
  ( printf 'DATABASE_PUBLIC_URL: '; read -rs u; printf '\n'
    DATABASE_URL="$u" pnpm db:adopt-baseline --check )
  ```

- **Expect:** `The schema matches 0000_baseline. Nothing was written.`
- **Verify:** Tell me the last line. On `Refused:`, stop here, go to step 6,
  and paste me the output: a diff holds schema lines only, never data or the
  URL. If the command throws instead (a stack trace from Docker, the network
  or `pg_dump`, with no `Refused:` or `The schema matches` line), it also wrote
  nothing: stop, still go to step 6, and paste me the error after checking it
  holds no URL or password.
- **Undo:** Not needed. `--check` writes nothing.
- **Ticks:** Ticket 02: "`db:adopt-baseline --check`".
- **Source:** `packages/database/src/adopt-baseline.ts`

### 4. Adopt the baseline

- [ ] **Done** (tick once Verify passes)
- **Goal:** `drizzle.__drizzle_migrations` records `0000_baseline` as
  applied.
- **Why:** The next `migrate` then skips the baseline and applies only newer
  migrations.
- **Where:** This terminal, straight after step 3.
- **Do:**

  ```bash
  ( printf 'DATABASE_PUBLIC_URL: '; read -rs u; printf '\n'
    DATABASE_URL="$u" pnpm db:adopt-baseline )
  ```

- **Expect:** `Adopted: drizzle.__drizzle_migrations records 0000_baseline as applied.`
  The command repeats step 3's check before writing.
- **Verify:** Tell me the last line. A `Refused:` line means nothing was
  written; paste it to me and go to step 6. If the command throws instead (a
  stack trace with no `Adopted:` or `Refused:` line), stop, don't rerun it,
  still go to step 6, and paste me the error after checking it holds no URL
  or password. A failure before the write leaves nothing behind, and one
  during it rolls the transaction back; step 5 confirms which.
- **Undo:** Not needed in practice. The write is one transaction holding the
  `drizzle` schema, its table and one row; dropping the `drizzle` schema
  reverses it.
- **Ticks:** Ticket 02: "`db:adopt-baseline` against production succeeds".
- **Source:** `packages/database/src/adopt-baseline.ts`

### 5. Confirm one row

- [ ] **Done** (tick once Verify passes)
- **Goal:** Exactly one row, holding the baseline's hash.
- **Why:** The row is what Drizzle's migrator reads; its hash is the SHA-256
  of `packages/database/drizzle/0000_baseline.sql`.
- **Where:** This terminal.
- **Do:**
  1. Read the pinned image, which is safe to print:

     ```bash
     image="$(sed -n 's/^FROM \(postgres:[^ ]*@sha256:[0-9a-f]*\).*/\1/p' apps/backup/Dockerfile)"
     printf '%s\n' "$image"
     ```

  2. List the rows:

     ```bash
     ( printf 'DATABASE_PUBLIC_URL: '; read -rs u; printf '\n'
       DATABASE_URL="$u" docker run --rm --network host --env DATABASE_URL "$image" \
         sh -c 'exec psql "$DATABASE_URL" -Atc "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations"' )
     ```

  3. Print the expected hash: `sha256sum packages/database/drizzle/0000_baseline.sql`
     (`shasum -a 256` on macOS).

- **Expect:** One line, `1|<HASH>|1790521579298`, where `<HASH>` equals the
  hash from 3.
- **Verify:** Tell me the line; note the hash under ticket 02's Comments. It
  is a hash of a public file, safe to share.
- **Undo:** Not needed.
- **Ticks:** Ticket 02: "exactly one row".
- **Source:** `packages/database/drizzle/meta/_journal.json` (`when`)

### 6. Remove the TCP proxy

- [ ] **Done** (tick once Verify passes)
- **Goal:** The database is private again.
- **Why:** Outside a run like this nothing is exposed (ADR 0013).
- **Where:** Railway dashboard → `database` → **Settings** → **Networking**
  (per docs, verify on screen).
- **Do:**
  1. Delete the TCP proxy.
  2. In the terminal: `unset image`.
- **Expect:** No proxy domain under Networking.
- **Verify:** I run
  `railway variable list --service database --json | jq 'has("DATABASE_PUBLIC_URL")'`,
  which prints `false`.
- **Undo:** Not needed.
- **Ticks:** Ticket 02: "TCP proxy disabled".
- **Source:** <https://docs.railway.com/networking/tcp-proxy>

## Troubleshooting

- `Refused: the schema differs from 0000_baseline` is followed by a diff:
  `-` lines are in the baseline but missing from production, `+` lines are in
  production only. Nothing was written. Don't adopt; close the proxy (step 6)
  while the drift waits for a decision.
- `Refused: The journal must hold only 0000_baseline` means `main` already
  holds a later migration. Adopting would record it as applied without
  running it. Stop, close the proxy (step 6) and tell me.
- `Refused: drizzle.__drizzle_migrations already exists` on step 3 means
  something already wrote the table, such as an earlier adoption or a
  `db:migrate` that failed (Drizzle creates the table before migrating). Run
  step 5 and paste me the rows before doing anything else, then close the
  proxy (step 6).
- `pg_dump failed: … server version mismatch` means production's PostgreSQL
  major is newer than the pinned image's. Stop and close the proxy (step 6):
  the backup job has the same problem, and its pin needs raising first.
- Any other thrown error (Docker not running, a connection timeout, a
  `pg_dump` failure) wrote nothing before the transaction and nothing that
  survives it. Stop, close the proxy (step 6), and paste me the error once you
  have checked it holds no URL or password.
