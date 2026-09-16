# 08: Extract the PostgreSQL database boundary

**What to build:** Give PostgreSQL and Drizzle one concrete package owner while
keeping the existing web application operational throughout the mechanical move.

**Blocked by:** 07: Extract category and transaction vocabulary

**Status:** done

- [x] Drizzle tables, relations, database construction, and database types have one owner in the database package.
- [x] Drizzle configuration, schema push, and PostgreSQL-backed test fixtures are owned by that package.
- [x] Runtime consumers inject validated connection configuration; the package does not read app environment variables implicitly.
- [x] Temporary forwarding exports keep unmigrated web consumers green without duplicating implementations.
- [x] All environments continue using `db:push`; no migration is generated, committed, or applied.

## Comments

- Created `packages/database` (`@bookkeeping/database`) with feature subpaths:
  `/connection` (`createDatabase`, `Database`, `DatabaseConnection`), `/auth`,
  `/wallets`, `/categories`, `/transactions` (Drizzle tables and relations,
  moved verbatim into `*.schema.ts` files), `/testing` (`setupTestDatabase`,
  `createTestUser`), `/testing/global-setup` (Vitest global setup), and
  `/testing/start-database` (Testcontainers starter used by the Playwright
  runner). Within the package, modules import each other relatively.
- `drizzle.config.ts`, `db:push`, and `db:studio` moved to the package; the
  root scripts filter to it. The config validates `DATABASE_URL` with Zod and
  drizzle-kit loads it from `packages/database/.env` (new `.env.example`), so
  the CLI no longer imports the web app's T3 Env module. The test harness pushes
  the schema with `pnpm --filter @bookkeeping/database db:push --force` and
  injects the container URL, which drizzle-kit's dotenv never overrides.
- The web app keeps only `core/database/client.ts`, which injects its own
  validated `env.DATABASE_URL` into `createDatabase`. `pg`, `@types/pg`,
  `drizzle-kit`, and `@testcontainers/postgresql` left the web package;
  `drizzle-orm` stays because feature operations and the Better Auth adapter use
  it directly.
- No forwarding exports were needed: every web consumer (pages, actions,
  feature operations, integration tests, the e2e runner, and the Vitest config)
  imports the package subpaths directly, so no duplicate implementation exists.
- The package owns one PostgreSQL-backed test
  (`src/testing/test-database.integration.test.ts`) proving its `db:push`,
  connection, and rollback fixtures work standalone. Biome overrides, Sonar
  scope, `.gitignore`, and the README track the new ownership.
- Verified with Biome, root `types:check`, the full `pnpm test` (server,
  domain, database, and web unit + PostgreSQL integration suites), the
  production build, and `pnpm db:push` against the local Compose database. No
  migration was generated, committed, or applied.
