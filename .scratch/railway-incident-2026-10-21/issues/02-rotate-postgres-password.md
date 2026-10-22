# 02: Rotate the Postgres password

Read `../spec.md` first (Impact, Decisions).

**What to build:** Production Postgres has a new password, api and backup
connect with it, and nobody else holds a session.

**Blocked by:** 01

**Status:** ready-for-human

**Notes:** Follow Railway's "Rotate PostgreSQL Database Credentials" guide.
Use **Regenerate**: never edit `POSTGRES_PASSWORD` or `PGPASSWORD` by hand,
and never run `ALTER USER`. The database restarts, and api is down until it
redeploys, so start right after a nightly backup, never near 20:00 UTC.

- [ ] Postgres → Database → Config → **Regenerate** done.
- [ ] api and backup both read `DATABASE_URL` from `${{Postgres.DATABASE_URL}}`, and both are redeployed.
- [ ] api deploy logs show no `password authentication failed`; recording a transaction from the phone works.
- [ ] A manually triggered backup run succeeds, and its objects appear in S3.
- [ ] `pg_stat_activity` shows only the expected sessions, and `pg_roles` has no role nobody created; findings recorded under Comments.
- [ ] Postgres still has no TCP proxy.
