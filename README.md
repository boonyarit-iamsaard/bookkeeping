# Bookkeeping

A phone-first bookkeeping application: a Vite and TanStack Router single-page
client installable as a PWA, calling a Hono API on Node.js, with TypeScript,
PostgreSQL, and Drizzle ORM. Email and password authentication uses Better
Auth, mounted in the API. Shared UI uses Tailwind CSS and shadcn components
with Base UI.

## Local setup

Install Node.js 24, pnpm 10.27.0, and Docker with Docker Compose support. Start Docker
before starting the database.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
cp apps/server/.env.example apps/server/.env
cp packages/database/.env.example packages/database/.env
cp .env.local.example .env.local
```

Set `BETTER_AUTH_SECRET` in `apps/server/.env` to a random secret of at least
32 characters (generate one with `openssl rand -base64 32`). Set
`DATABASE_URL` in `apps/server/.env` and `packages/database/.env` to match the
PostgreSQL credentials in the root `.env.local`, which Docker Compose reads. Then start the
database and both apps:

```bash
pnpm db:start
pnpm db:push
pnpm dev
```

`pnpm dev` runs the client and the API together through Turborepo and stops
them when you interrupt it; `pnpm dev:web` and `pnpm dev:server` run one alone.

Open [localhost:4000](http://localhost:4000). The home page redirects to
`/wallets`; without a session, every app page redirects to `/sign-in`. Create
an account at `/sign-up`. The API answers at
[localhost:5000/health](http://localhost:5000/health); see
[Local origins](#local-origins) to change either address.

Global styles are in `apps/web/src/styles/globals.css`. Fonts are Inter and
JetBrains Mono, declared in `apps/web/src/styles/fonts.css`.

## Project structure

The repo is a pnpm workspace with Turborepo (see
[ADR 0002](docs/adr/0002-turborepo-monorepo.md)). `apps/web` is the
single-page client ([ADR 0006](docs/adr/0006-vite-tanstack-router-spa-client.md))
and `apps/server` is the Hono API, the sole application backend
([ADR 0003](docs/adr/0003-hono-application-backend.md)). Backend code lives in
private `packages/*` (see
[ADR 0004](docs/adr/0004-shared-backend-package-graph.md)).

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
      dashboard/          # Balances and monthly summary for chosen dates
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

`pnpm --filter @bookkeeping/web generate:api` rewrites
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
      transactions/       # /v1/transactions: list with cursors, get, create, update, delete, refunds, entry defaults
      wallets/            # /v1/wallets: list with as-of balances, get, create, replace opening balances, archive, and delete
    server.ts             # Node entrypoint: parses env and serves the app
    testing/              # Unit and integration app factories and problem assertions
  scripts/build.ts        # esbuild bundle of the entrypoint and workspace packages
```

[docs/api-parity.md](docs/api-parity.md) is the closing audit that mapped
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
particular feature. See [code conventions](docs/code-conventions.md) for the
authoritative structure, filename and symbol naming rules, dependency
boundaries, cached reads, and enforcement.

Application operations take a `Database` parameter and import tables from the
`@bookkeeping/database` feature subpaths, so tests can run them inside a
rolled-back transaction. The server opens its one connection by passing its
validated `DATABASE_URL` to `createDatabase` from
`@bookkeeping/database/connection`. The Drizzle CLI reads the schema through
`packages/database/drizzle.config.ts`.

## Environment configuration

Each app validates its own environment with Zod.

`apps/web/.env` (copy `apps/web/.env.example`):

| Variable          | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| `VITE_API_ORIGIN` | The API origin, locally `http://localhost:5000` |

Vite inlines `VITE_` variables into the bundle, so the API origin is fixed at
build time. `apps/web/src/core/env/config.ts` validates it when the client
loads.

`apps/server/.env` (copy `apps/server/.env.example`), or the deployed server
environment:

| Variable                  | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`      | Auth secret of at least 32 characters                                |
| `BETTER_AUTH_URL`         | The API origin, locally `http://localhost:5000`                      |
| `CLIENT_ORIGINS`          | Comma-separated client origins allowed to send credentialed requests |
| `DATABASE_URL`            | PostgreSQL connection URL                                            |
| `HOST`, `PORT`            | Optional; default `0.0.0.0` and `5000`                               |
| `AUTH_RATE_LIMIT_ENABLED` | Optional `true` or `false`; unset throttles only in production       |
| `AUTH_SIGN_UP_ENABLED`    | Optional `true` or `false`, default `true`; `false` refuses sign-ups |

`apps/server/src/core/env/config.ts` validates these at startup.
`pnpm dev:server` loads `apps/server/.env` when it exists;
`pnpm --filter @bookkeeping/server start` runs the compiled production output
with the environment the caller injects. The Drizzle CLI reads `DATABASE_URL`
from `packages/database/.env` (copy `packages/database/.env.example`) and
validates it in `drizzle.config.ts`.

The local Docker Compose infrastructure reads the root `.env.local` (see
`.env.local.example`); its `POSTGRES_PASSWORD` must match the password embedded
in `DATABASE_URL`.

`pnpm build` builds both apps and every package through Turborepo: the Vite
client build (which first checks the generated API client) and the server's
esbuild bundle. `pnpm start` builds if needed and then serves both production
outputs, the client through `vite preview`; `pnpm start:web` and
`pnpm start:server` run one app alone.

### Local origins

Each app owns its local origin:

| App                 | Default origin          | Configured by                                               |
| ------------------- | ----------------------- | ----------------------------------------------------------- |
| SPA client (`web`)  | `http://localhost:4000` | `--port 4000 --strictPort` in its `dev` and `start` scripts |
| Hono API (`server`) | `http://localhost:5000` | `HOST` and `PORT` in `apps/server/.env`                     |

Vite reads the client port from the CLI flags in `apps/web/package.json`. The
server reads `HOST` and `PORT` from its
environment; `pnpm dev:server` loads `apps/server/.env`, and the `dev` task
passes shell `HOST` and `PORT` through Turborepo, so
`PORT=5001 pnpm dev:server` also works. Both ports avoid the common `3000`
default so a stray dev server elsewhere does not collide with either app.
When either origin changes, update the server's `BETTER_AUTH_URL` (the API
origin), its `CLIENT_ORIGINS` (the client origin), and the client's
`VITE_API_ORIGIN` to match.

## Database commands

| Command          | Purpose                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| `pnpm db:start`  | Start local PostgreSQL and wait for its health check, using root `.env.local` |
| `pnpm db:stop`   | Stop the local container while retaining its data volume                      |
| `pnpm db:push`   | Apply schema changes directly for local development                           |
| `pnpm db:studio` | Open Drizzle Studio                                                           |

These commands need only Docker and `packages/database/.env`; neither app has
to be running. `db:push` and `db:studio` run the Drizzle CLI from
`packages/database`, which owns the schema.

The schema-change policy in [AGENTS.md](AGENTS.md#database-schema-changes)
requires `db:push` until the user explicitly authorizes switching to migrations.

PostgreSQL stores its initialized credentials in the persistent data volume.
Changing `POSTGRES_PASSWORD` in `.env.local` does not change the password of an
already initialized database; update the existing database password, `.env.local`,
and `DATABASE_URL` in `apps/server/.env` and `packages/database/.env` together when
changing credentials.

## Tests

```bash
pnpm test          # Vitest: unit and PostgreSQL integration tests, both apps and every package
pnpm test:watch    # The same suites in watch mode, per workspace, through Turborepo
pnpm test:e2e      # Playwright: SPA browser flows against an isolated API and database
pnpm run ci        # Routine static, type, unit, integration, and contract checks, then both app builds
pnpm run ci:e2e    # Explicit production-build browser gate
```

Unit tests (`*.unit.test.ts`) are colocated with their source modules and need
no Docker or `.env` file. Run one workspace's suite with, for example,
`pnpm --filter @bookkeeping/web test`.

Integration tests (`*.integration.test.ts`) use Testcontainers to start a disposable
PostgreSQL 18 database on an available port. Docker must be running. The harness,
owned by `@bookkeeping/database/testing`, applies the current schema with the
database package's `db:push`, provides its connection URL to test workers, and
stops the container after the suite. Every test runs inside a
transaction that is rolled back, except concurrency checks that use committed
writes isolated by owner. No local development database is used.

Browser tests live in `apps/web/tests/e2e/`. Install their browsers once:

```bash
pnpm --filter @bookkeeping/web exec playwright install --with-deps chromium
```

The runner (`apps/web/tests/e2e/run.ts`) creates its own disposable PostgreSQL
database, pushes the schema, and starts the Hono API from source and the
client on available ports with a fresh auth secret. It serves the client with
Vite locally; under `ci:e2e` it builds a client for `vite preview` with the
test API origin baked in. It waits for server teardown before stopping the
database, including when interrupted. Specs run on 360px Chromium; tests tagged
`@matrix` also run on desktop Chromium. See the
[test ownership](docs/code-conventions.md#test-ownership) rules and the
browser test policy in [AGENTS.md](AGENTS.md).

## Local SonarQube

SonarQube is an optional, on-demand analysis tool. Run it when the project owner
requests a scan or when you choose to inspect code quality. Setup and scans are
not required for local development, commits, pull requests, or completing project
work. SonarQube is not part of `pnpm run ci`, GitHub Actions, or commit hooks;
its quality gate does not block this project's workflow.

Set up the separate SonarQube Community Build stack:

```bash
pnpm sonar:setup
pnpm sonar:scan
```

Setup starts the containers, waits for readiness, replaces the default admin
password with a random password, creates the private `bookkeeping` project, and
generates a project analysis token. It saves credentials in the Git-ignored
`.env.sonar` with owner-only file permissions. The scan command loads the token
automatically. Rerunning setup reuses a valid token.

After each successful scan, the command waits for that scan's server processing
and exports all current project issues (including resolved issues) and detailed
security hotspots to `.sonar-reports/issues.json` and `.sonar-reports/issues.md`.
JSON preserves issue fields, related locations, rules, and hotspot details;
Markdown provides a readable list with links to the dashboard. Reports are
Git-ignored and overwritten on the next successful export. They describe current
project state, rather than an immutable historical analysis. Avoid simultaneous
scans of the same project while exporting. Use `pnpm sonar:export` to retry an
export without rescanning; it uses the last saved scan task ID.

Open [localhost:9000](http://localhost:9000) and use the admin credentials from
`.env.sonar`. If you previously changed the admin password, supply your existing
`SONAR_ADMIN_PASSWORD` (and `SONAR_ADMIN_LOGIN` if needed) in the shell environment
before running setup. Do not commit or share `.env.sonar`.

The scanner analyzes
`apps/web/src/`, `apps/server/src/`, `packages/domain/src/`,
`packages/database/src/`, `packages/application/src/`, and `packages/auth/src/`
and classifies colocated Vitest tests and `apps/web/tests/` as test code; it
skips the generated route tree. It does
not run tests or generate coverage; coverage reporting is not configured.

`pnpm sonar:stop` stops this stack and retains its database and analysis data.
For later on-demand scans, run `pnpm sonar:start`, then `pnpm sonar:scan`.
Stop the stack when you finish to free its resources.
The stack uses its own PostgreSQL database and exposes the dashboard only on
localhost. It disables Elasticsearch bootstrap checks for local development.
Both database stacks use `postgres:18-alpine`, sharing the downloaded image.
The SonarQube stack follows the app's Compose conventions with explicit
container, volume, and network names. Its PostgreSQL data mounts at
`/var/lib/postgresql`, as required by the PostgreSQL 18 image layout.
The images use moving tags; pin versions before relying on this setup in CI or
running a shared server. If port 9000 is already occupied by a trial SonarQube
container, stop that container before starting this stack.

See the official [Docker setup](https://docs.sonarsource.com/sonarqube-community-build/server-installation/from-docker-image/set-up-and-start-container)
and [scanner guide](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/scanners/sonarscanner).

## Checks

```bash
pnpm lint
pnpm format:check
pnpm lint:md
pnpm types:check
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm run ci` runs the routine check sequence without browser tests: formatting,
linting, every workspace type check, the package and app suites (unit,
PostgreSQL integration, and the Hono contract tests), and then both app builds
as a separate step, so a production build never runs beside the test suites.
The explicit `pnpm run ci:e2e` gate builds the client and runs the full
browser matrix against `vite preview`; run it on its own, never beside another
heavy task.
`pnpm build`, `pnpm test`, and `pnpm types:check` run through Turborepo, which
caches and parallelizes per-workspace tasks across `apps/web`, `apps/server`,
and `packages/*` (see [ADR 0002](docs/adr/0002-turborepo-monorepo.md)).
`pnpm check` applies Biome fixes;
`pnpm format` formats Markdown, YAML, and HTML files.

GitHub Actions runs `.github/workflows/ci.yaml` on pull requests and pushes to
`main`. Two jobs run side by side, each installing dependencies with a frozen
lockfile: one runs `pnpm run ci`, and the other installs Chromium
(cached by Playwright version) and runs the SPA browser suite on two workers.
The browser runner switches the API's sign-up throttle off
(`AUTH_RATE_LIMIT_ENABLED=false`) so parallel sign-ups never meet it. Testcontainers
supplies disposable PostgreSQL databases for both operation and browser tests.
No job needs a checked-in `.env` file.

To run the workflow locally, install `act`, start Docker, and run:

```bash
act push -j ci
```

`.actrc` selects the `catthehacker/ubuntu:act-latest` runner image and
`linux/amd64` architecture. Testcontainers manages PostgreSQL, so local CI
needs Docker access.
