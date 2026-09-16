# 08: Extract the PostgreSQL database boundary

**What to build:** Give PostgreSQL and Drizzle one concrete package owner while
keeping the existing web application operational throughout the mechanical move.

**Blocked by:** 07: Extract category and transaction vocabulary

**Status:** ready-for-agent

- [ ] Drizzle tables, relations, database construction, and database types have one owner in the database package.
- [ ] Drizzle configuration, schema push, and PostgreSQL-backed test fixtures are owned by that package.
- [ ] Runtime consumers inject validated connection configuration; the package does not read app environment variables implicitly.
- [ ] Temporary forwarding exports keep unmigrated web consumers green without duplicating implementations.
- [ ] All environments continue using `db:push`; no migration is generated, committed, or applied.
