# Extract a concrete shared backend package graph

With Next.js and Hono as real consumers during the backend migration, shared
code will move into `@bookkeeping/domain`, `@bookkeeping/database`,
`@bookkeeping/application`, and `@bookkeeping/auth`. The dependencies flow from
application to database to domain, while auth composes the database and
application provisioning behavior for both app adapters. Feature-first
directories remain inside those packages, and concrete packages are preferred
over a broad infrastructure package so unrelated adapters do not accumulate
behind an ambiguous boundary.

## Consequences

- `@bookkeeping/domain` has no React, Next.js, Hono, Drizzle, or environment
  dependencies.
- `@bookkeeping/database` owns PostgreSQL and Drizzle concerns and imports
  domain vocabulary where persistence needs it.
- `@bookkeeping/application` owns use cases and business invariants and uses
  the concrete database boundary; no repository abstraction is introduced
  while only one database implementation exists.
- `@bookkeeping/auth` owns framework-independent Better Auth configuration,
  its database adapter, session contracts, and provisioning hook. Each app
  owns only its framework-specific mount and client adapter.
- Next.js Server Actions and Hono routes remain adapters outside these
  packages.
- HTTP contracts stay with the Hono app until another client consumes them.
- These private workspace packages expose TypeScript source through explicit
  export maps; consuming app builds compile it. Each package still owns its
  type-check and test tasks, but no independent publication build is required.
- The database package owns Drizzle schema and configuration, database
  construction, test fixtures, and `db:push`; apps validate environment input
  and inject runtime configuration. No migrations are generated or applied.
- Extraction is gradual: scaffold Hono, move only the domain and database
  foundations needed for the next capability, then migrate application
  behavior and expose its HTTP slice capability by capability. Every step
  updates consumers and keeps both applications buildable and tested; there
  is no repository-wide package move or flag-day cutover.
- Packages expose feature-specific subpaths rather than a growing root barrel.
- Each HTTP slice keeps pure mapping tests, PostgreSQL-backed application tests,
  and in-process authenticated and unauthenticated Hono tests. The existing
  Next.js Playwright suite remains in place until the later SPA migration.
- Capability extraction follows dependency order: wallets, categories,
  transactions (including transfers and refunds), then history and reports.
