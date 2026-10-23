# 02: Rotate the Postgres password

Read `../spec.md` first (Impact, Decisions).

**What to build:** Production Postgres has a new password, api and backup
connect with it, and nobody else holds a session.

**Blocked by:** 01

**Status:** done

**Notes:** Follow Railway's "Rotate PostgreSQL Database Credentials" guide.
Use **Regenerate**: never edit `POSTGRES_PASSWORD` or `PGPASSWORD` by hand,
and never run `ALTER USER`. The database restarts, and api is down until it
redeploys, so start right after a nightly backup, never near 20:00 UTC.

- [x] Postgres → Database → Config → **Regenerate** done.
- [x] api and backup both read `DATABASE_URL` from `${{Postgres.DATABASE_URL}}`, and both are redeployed.
- [x] api deploy logs show no `password authentication failed`; recording a transaction from the phone works.
- [x] A manually triggered backup run succeeds, and its objects appear in S3.
- [x] `pg_stat_activity` shows only the expected sessions, and `pg_roles` has no role nobody created; findings recorded under Comments.
- [x] Postgres still has no TCP proxy.

## Comments

**2026-10-23, 02:10 UTC (agent):** The owner confirmed that api and backup
use `${{database.DATABASE_URL}}`; the Postgres service is named `database`.
They regenerated the password and redeployed api (`2afde4c1`, `0cd87f9`) and
backup (`8e22384b`). Both deployments are `SUCCESS`. api `/health` returns
`{"status":"ok"}`, the api logs have no `password authentication failed`, and
the owner recorded a transaction from the phone. The database still has no
TCP proxy.

The manual backup run at 02:01 UTC logged `uploaded to daily/2026-10-23/`.
`backup.sh` names the prefix by the Bangkok date and uses fixed object names,
and last night's 20:04 UTC run already wrote that prefix. So each of the
prefix's two keys now has two versions, which Object Lock keeps. That is the
planted-backup signature, and the restore drill refuses it (see the spec's
Decisions). Every manual run collides with that Bangkok date's nightly run,
before or after it. Ticket 04 needs a manual run too, so this has to be
decided first.

Still open: the S3 version listing for `daily/2026-10-23/`, and a re-run of the
`pg_stat_activity` and `pg_roles` queries. The first attempt returned no rows,
which can't be right: `pg_roles` always has `postgres`.

**2026-10-23, 02:20 UTC (agent):** The S3 version listing for `daily/2026-10-2`
confirms the manual run's objects. `daily/2026-10-20/` to `daily/2026-10-22/`
have one version per key, and there are no delete markers.
`daily/2026-10-23/` has the two expected versions per key: the nightly run at
20:04:10–11 UTC on 2026-10-22 (not latest), and the manual run at
02:01:12–13 UTC on 2026-10-23 (latest). Nothing else was uploaded.

**2026-10-23 (owner):** In `railway connect database`, `pg_stat_activity`
returned one session, the owner's own psql session as `postgres`. `pg_roles`,
excluding the built-in `pg_*` roles, returned only `postgres`. No unexpected
sessions or roles. A re-run gave the same result.

**Closed:** the password is regenerated, and api and backup connect with it.
Tickets 03 and 04 are unblocked. Before ticket 04's manual backup run, decide
how manual runs avoid sharing a `daily/` key with that day's nightly run.

**2026-10-23, 02:22 UTC (owner):** The exact output: `pg_stat_activity` had
one row, `postgres` / `psql` / `127.0.0.1`, started at 02:22:11 UTC.
`pg_roles` returned only `postgres`. `railway connect database` reaches the
database through an SSH tunnel on `127.0.0.1`, not a TCP proxy, and needed an
SSH key registered with Railway. The owner kept that key. It is a new
credential on the Railway account, so the incident's closing review should
list it.
