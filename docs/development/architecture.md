# Architecture

The repo is a pnpm workspace with Turborepo (see
[ADR 0002](../adr/0002-turborepo-monorepo.md)). `apps/web` is the
single-page client ([ADR 0006](../adr/0006-vite-tanstack-router-spa-client.md))
and `apps/server` is the Hono API, the sole application backend
([ADR 0003](../adr/0003-hono-application-backend.md)). Shared backend code
lives in private `packages/*` (see
[ADR 0004](../adr/0004-shared-backend-package-graph.md)).

```text
apps/web/
  index.html              # The app shell Vite serves and builds
  public/                 # PWA icons and the offline fallback page
  src/
    routes/               # TanStack Router file routes; _auth and _app are the signed-out and guarded layouts
    core/
      api/                # Typed API client generated from the server's OpenAPI document, read queries, write helper
      auth/               # Better Auth browser client against the API and the session read
      env/config.ts       # Client environment schema (VITE_API_ORIGIN)
      query/              # TanStack Query client and cached-read refresh after writes
      router/             # Router construction
      shell/              # App header and navigation
    features/
      auth/               # Sign-in/sign-up forms, provisioning retry, and sign-out
      categories/         # Category labels, forms, and management
      home/               # Home: wallet balances, this month, and recent transactions
      reports/            # Monthly totals, category breakdown, and balance trend
      transactions/       # Entry, history, detail, correction, transfer, and refund
      wallets/            # Wallet labels, forms, list, and detail
    shared/
      components/ui/      # Reusable UI primitives
      components/form/    # Reusable form feedback
      helpers/            # Helpers independent of business features
    styles/               # Global styles and fonts
  scripts/generate-api.ts # Regenerates the committed OpenAPI document and client types
  tests/
    e2e/                  # Playwright browser tests and their runner
```

`pnpm generate:api` rewrites
`src/core/api/openapi.json` and `openapi.gen.ts` from the server's app factory
without starting a server; the client build fails when they no longer match.
Run it after changing an API route. `pnpm --filter @bookkeeping/web
generate:icons` regenerates the PWA icons from `public/icon.svg`.

The server app follows the same `core` and `features` split:

```text
apps/server/
  src/
    core/
      app.ts              # Hono app assembly shared by tests and the entrypoint
      auth/               # Better Auth mount and the session requirement for /v1
      env/config.ts       # Server environment schemas and runtime validation
      http/               # Request context, CORS, Problem Details, Money, idempotency, OpenAPI document
    features/
      categories/         # /v1/categories: list, get, create, update, usage, remove, and provisioning retry
      health/             # Health check resource
      reports/            # /v1/reports/monthly: server-calculated monthly totals
      sign-up/            # /sign-up: whether sign-up is open or closed
      transactions/       # /v1/transactions: list with cursors, get, create, update, delete, refunds, entry defaults
      wallets/            # /v1/wallets: list with as-of balances, get, create, replace opening balances, archive, and delete
    reset-password-cli.ts # Owner-run lockout recovery: sets an Account's password
    server.ts             # Node entrypoint: parses env and serves the app
    testing/              # Unit and integration app factories and problem assertions
  scripts/build.ts        # esbuild bundle of the entrypoint and workspace packages
```

[docs/api-parity.md](../api-parity.md) is the closing audit that mapped
every user-visible flow of the former Next.js app to the Hono operation that
covers it, with the differences that are deliberate.

Better Auth answers under `/api/auth/*` on the API origin; every route below
`/v1` requires the API session cookie and otherwise returns an
`unauthenticated` problem. `CLIENT_ORIGINS` in `apps/server/.env` lists the
browser origins allowed to send credentialed requests; they are also Better
Auth's trusted origins.

Money crosses HTTP as `{ value, currency }`, where `value` is an exact
major-unit decimal string (`"125.50"`, always two fractional digits for THB)
presented from the application's integer satang; no amount passes through a
JavaScript `number`. A wallet that does not exist, belongs to another owner,
or has a malformed id answers the same `not-found` problem.

`@bookkeeping/domain` owns framework-independent vocabulary and exact value
behavior. It exposes TypeScript source through feature subpaths rather than a
root barrel, and each consuming app's build compiles it:

```text
packages/domain/
  src/
    categories/           # @bookkeeping/domain/categories: category kinds and shapes
    dates/                # @bookkeeping/domain/dates: calendar dates and instants
    money/                # @bookkeeping/domain/money: exact bigint money and currency
    result/               # @bookkeeping/domain/result: Result, ok, err
    transactions/         # @bookkeeping/domain/transactions: transaction types and shapes
    wallets/              # @bookkeeping/domain/wallets: wallet types and shapes
```

`@bookkeeping/database` owns PostgreSQL and Drizzle: the tables and relations,
database construction, the Drizzle CLI configuration, and the Testcontainers
fixtures that the integration and browser suites start. It imports domain
vocabulary where persistence needs it and receives a validated connection URL
from each runtime consumer rather than reading any app's environment:

```text
packages/database/
  drizzle.config.ts       # Drizzle CLI: reads DATABASE_URL from packages/database/.env
  src/
    connection.ts         # @bookkeeping/database/connection: createDatabase, Database
    auth/                 # @bookkeeping/database/auth: users, sessions, accounts, verifications
    categories/           # @bookkeeping/database/categories: categories
    idempotency/          # @bookkeeping/database/idempotency: creation receipts
    transactions/         # @bookkeeping/database/transactions: transactions, legacy receipts, changes
    wallets/              # @bookkeeping/database/wallets: wallets, wallet changes
    testing/              # @bookkeeping/database/testing: setupTestDatabase, createTestUser
```

`@bookkeeping/application` owns use cases and the invariants they enforce. It
uses the concrete database package directly (no repository abstraction) and
exposes each feature's operations, their input and outcome contracts, through
a feature subpath. Its PostgreSQL-backed integration tests are the primary
proof of ownership, atomicity, concurrency, and idempotency:

```text
packages/application/
  src/
    categories/           # @bookkeeping/application/categories: listCategories, findCategory, createCategory, updateCategory, category usage, initializeDefaultCategories
                          # @bookkeeping/application/categories/defaults: the default trees
    idempotency/          # @bookkeeping/application/idempotency: replay-safe creation
    testing/              # @bookkeeping/application/testing/*: fixtures shared by application and server tests
    transactions/         # @bookkeeping/application/transactions: listTransactions, findTransaction, createTransaction, updateTransaction, deleteTransaction, findExpenseRefunds, getMonthlySummary, ...
    wallets/              # @bookkeeping/application/wallets: listWallets, findWallet, createWallet, deleteWallet, ...
```

Resource creation uses `executeIdempotentCreation` with an authenticated owner,
a stable operation name, a client key, and the complete validated application
payload. Equal retries replay the stored application result; conflicting payloads
are rejected. The result codec is owned by the application operation, so receipts
remain independent of HTTP response shapes.

`@bookkeeping/auth` owns the framework-independent Better Auth configuration:
the Drizzle adapter over the database package's auth tables (with transactions
enabled for Better Auth's own multi-write flows), the session contract the
server derives owner ids from, and the fresh-user provisioning hook. That
hook runs `initializeDefaultCategories` after a sign-up commits; because it
runs post-commit, a failure is logged rather than failing the sign-up, and the
explicit retry `POST /v1/categories/defaults`, which the client sends after
sign-in and sign-up, completes the set. That POST is an idempotent
action rather than resource creation: it needs no `Idempotency-Key` and
answers `200` with the trees it seeded, not `201` with a `Location`. Reads
never provision. The server passes its validated secret and base URL and
mounts the configuration; the API origin keeps its own host-only cookie:

```text
packages/auth/
  src/
    config.ts             # @bookkeeping/auth/config: createAuth, Auth, AuthOptions
    password-reset.ts     # @bookkeeping/auth/password-reset: resetPassword
    session.ts            # @bookkeeping/auth/session: Session, SessionUser, resolveSession
```

Hono routes describe their responses with the same Zod schemas that tests
parse actual responses against, and `hono-openapi` generates an OpenAPI 3.1
document from those route definitions at `GET /openapi.json`. There is no
handwritten contract file; `apps/server/src/core/http/openapi.unit.test.ts`
validates the generated document and fails when a registered route is not
described.

Keep routes focused on composing features. Group business logic, vocabulary,
and UI by feature. Promote code to `shared/` only when it is independent of a
particular feature. See [code conventions](../code-conventions.md) for the
authoritative structure, filename and symbol naming rules, dependency
boundaries, cached reads, and enforcement.

Application operations take a `Database` parameter and import tables from the
`@bookkeeping/database` feature subpaths, so tests can run them inside a
rolled-back transaction. The server opens its one connection by passing its
validated `DATABASE_URL` to `createDatabase` from
`@bookkeeping/database/connection`. The Drizzle CLI reads the schema through
`packages/database/drizzle.config.ts`.

`apps/backup/` (backup job, restore drill) and `infra/aws/` sit outside the
pnpm workspace; see the [backup README](../../apps/backup/README.md) and the
[AWS README](../../infra/aws/README.md).
