# Bookkeeping

A bookkeeping application built with Next.js App Router, TypeScript, PostgreSQL,
and Drizzle ORM. Email and password authentication uses Better Auth. Shared UI
uses Tailwind CSS and shadcn components with Base UI.

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

Set `BETTER_AUTH_SECRET` in `apps/web/.env` to a random secret of at least 32
characters (generate one with `openssl rand -base64 32`). Then start the
database and both apps:

```bash
pnpm db:start
pnpm db:push
pnpm dev
```

For an existing checkout, keep your existing `apps/web/.env`. Set `DATABASE_URL`
in both `apps/web/.env` and `packages/database/.env` to match the PostgreSQL
credentials in the root `.env.local` Compose file.

`pnpm dev` runs the Next.js UI and the Hono API together through Turborepo and
stops both when you interrupt it. Run one app alone with `pnpm dev:web` or
`pnpm dev:server`.

Open [localhost:4000](http://localhost:4000). The home page is
`apps/web/src/app/page.tsx` and redirects to `/dashboard`. Without a session, the dashboard
redirects to `/sign-in`. Create an account at `/sign-up`. The API answers at
[localhost:5000/health](http://localhost:5000/health); see
[Local origins](#local-origins) to change either address.

Global styles are in `apps/web/src/styles/globals.css`. Fonts are Inter
and JetBrains Mono, configured in `apps/web/src/styles/fonts.ts`.

## Project structure

The repo is a pnpm workspace with Turborepo; `apps/web` is the Next.js app and
`apps/server` is the standalone Hono backend being introduced under
[ADR 0003](docs/adr/0003-hono-application-backend.md). Further services will
live beside them as further `apps/*` (see
[ADR 0002](docs/adr/0002-turborepo-monorepo.md)). Code both apps need lives in
private `packages/*` (see
[ADR 0004](docs/adr/0004-shared-backend-package-graph.md)).

```text
apps/web/
  src/
    app/                  # Route entry points, layouts, and route handlers
    core/
      auth/               # Better Auth setup, browser client, and session helper
      env/config.ts       # T3 Env schemas and runtime validation
      database/
        client.ts         # Server-only Drizzle client for the app
        database.ts       # Database factory and the Database type operations accept
        schema/           # Tables and relations, also used by Drizzle CLI
    features/
      auth/               # Sign-in/sign-up forms, hooks, and sign-out button
      categories/         # Category vocabulary, behavior, and picker forms
      transactions/       # Transaction vocabulary, behavior, and entry form
      wallets/            # Wallet operations, server actions, form, and list
    shared/
      components/ui/      # Reusable UI primitives
      components/form/    # Reusable form feedback
      helpers/            # Helpers independent of business features
    styles/               # Global styles and fonts
  tests/
    database/             # PostgreSQL test harness (setup, rollback helper)
    e2e/                  # Playwright browser tests
```

The server app mirrors the same layout:

```text
apps/server/
  src/
    core/
      app.ts              # Hono app assembly shared by tests and the entrypoint
      env/config.ts       # Server environment schemas and runtime validation
      http/               # Request context, Problem Details, OpenAPI document
    features/
      health/             # Health check resource
    server.ts             # Node entrypoint: parses env and serves the app
```

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
    transactions/         # @bookkeeping/database/transactions: transactions, receipts, changes
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
    categories/           # @bookkeeping/application/categories: initializeDefaultCategories
                          # @bookkeeping/application/categories/defaults: the default trees
```

Hono routes describe their responses with the same Zod schemas that tests
parse actual responses against, and `hono-openapi` generates an OpenAPI 3.1
document from those route definitions at `GET /openapi.json`. There is no
handwritten contract file; `apps/server/src/core/http/openapi.unit.test.ts`
validates the generated document and fails when a registered route is not
described.

Keep routes focused on composing features. Group business logic, vocabulary,
and UI by feature. Promote code to `shared/` only when it is independent of a
particular feature. Database schemas import pure feature vocabulary from
`*.types.ts`; those modules have no database, server, or UI dependencies.
See [code conventions](docs/code-conventions.md) for the authoritative structure,
filename and symbol naming rules, dependency boundaries, and enforcement.

Server-side feature code can import `db` from `@/core/database/client`, the
web app's one connection, which it opens by passing its validated
`DATABASE_URL` to `createDatabase` from `@bookkeeping/database/connection`.
Keep that client out of Client Components. Feature operations take a
`Database` parameter and import tables from the `@bookkeeping/database`
feature subpaths, so tests can run them inside a rolled-back transaction. The
Drizzle CLI reads the schema through `packages/database/drizzle.config.ts`.

## Environment configuration

Set these values in `apps/web/.env` for local development or inject them into
the server environment when deploying:

| Variable             | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `BETTER_AUTH_SECRET` | Auth secret of at least 32 characters         |
| `BETTER_AUTH_URL`    | App base URL, locally `http://localhost:4000` |
| `DATABASE_URL`       | PostgreSQL connection URL                     |

T3 Env validates these values when `apps/web/src/core/env/config.ts` loads,
including during database and auth initialization. The Drizzle CLI does not
read this file; it reads `DATABASE_URL` from `packages/database/.env` (copy
`packages/database/.env.example`) and validates it in `drizzle.config.ts`.

The local Docker Compose infrastructure reads the root `.env.local` (see
`.env.local.example`); its `POSTGRES_PASSWORD` must match the password embedded
in `DATABASE_URL`.

`pnpm build` sets `SKIP_ENV_VALIDATION=1` only for the build process, allowing the
app to build without runtime secrets or a running database. Do not set that flag
in the deployed server environment. `pnpm start` runs the production build with
runtime validation enabled.

The Hono server owns its own environment. `apps/server/src/core/env/config.ts`
validates optional `PORT` (default `5000`) and `HOST` (default `0.0.0.0`)
values from the server environment with Zod at startup and ignores the web
app's variables. `pnpm dev:server` loads `apps/server/.env` when it exists
(copy `apps/server/.env.example`); `pnpm --filter @bookkeeping/server start`
runs the compiled production output with the environment the caller injects.

### Local origins

Each app owns its local origin:

| App                 | Default origin          | Configured by                                  |
| ------------------- | ----------------------- | ---------------------------------------------- |
| Next.js UI (`web`)  | `http://localhost:4000` | `-p 4000` in the web `dev` and `start` scripts |
| Hono API (`server`) | `http://localhost:5000` | `HOST` and `PORT` in `apps/server/.env`        |

Next.js reads its port from the CLI, not from `.env`, so the web scripts pass
`-p 4000` explicitly; change it with `pnpm dev:web -- -p 4001` and update
`BETTER_AUTH_URL` to match. The web `start` script uses `${PORT:-4000}` so a
deployment platform that injects `PORT` still wins. The server reads `HOST`
and `PORT` from its environment; `pnpm dev:server` loads `apps/server/.env`,
and the `dev` task passes shell `HOST` and `PORT` through Turborepo, so
`PORT=5001 pnpm dev:server` also works. Both ports avoid the Next.js default
of `3000` so a stray `next dev` elsewhere does not collide with either app.

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
and `DATABASE_URL` in `apps/web/.env` and `packages/database/.env` together when
changing credentials.

## Tests

```bash
pnpm test          # Vitest: unit and PostgreSQL integration tests
pnpm test:e2e      # Playwright: browser flows against an isolated app/database
pnpm run ci        # Routine static, type, unit, integration, and contract checks
pnpm run ci:e2e    # Explicit production-build browser compatibility gate
```

Tests load `apps/web/.env` in every environment. GitHub Actions copies the
checked-in `apps/web/.env.ci.example` to `apps/web/.env` before running checks.
Runtime environment validation
stays enabled. Testcontainers supplies the database URL, and the browser runner
overrides the app URL with its actual port.

Unit tests (`*.unit.test.ts`) are colocated with their source modules. Run them
without Docker using `pnpm --filter @bookkeeping/web exec vitest run --project unit`.

Integration tests (`*.integration.test.ts`) use Testcontainers to start a disposable
PostgreSQL 18 database on an available port. Docker must be running. The harness,
owned by `@bookkeeping/database/testing`, applies the current schema with the
database package's `db:push`, provides its connection URL to test workers, and
stops the container after the suite. Every test runs inside a
transaction that is rolled back, except concurrency checks that use committed
writes isolated by owner. No local development database is used. Run this suite
alone using `pnpm --filter @bookkeeping/web exec vitest run --project integration`.

Browser tests live in `apps/web/tests/e2e/` and need Chromium once:

```bash
pnpm --filter @bookkeeping/web exec playwright install --with-deps chromium
```

The browser runner creates its own disposable PostgreSQL database, pushes the
schema, and starts a fresh app server on an available port. It uses `pnpm dev`
locally and `pnpm start` in CI. It waits for server teardown before stopping
the database, including when interrupted. Server errors remain visible; enable
server stdout and startup diagnostics with `DEBUG=pw:webserver pnpm test:e2e`.

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
`packages/database/src/`, and `packages/application/src/` and classifies
colocated Vitest tests and
`apps/web/tests/` as test code. It does
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

`pnpm run ci` runs the routine check sequence without browser tests. The explicit
`pnpm run ci:e2e` compatibility gate builds the application and runs the browser
suite against the production server using `next start`.
`pnpm build`, `pnpm test`, and `pnpm types:check` run through Turborepo, which
caches and parallelizes per-workspace tasks across `apps/web`, `apps/server`,
and `packages/*` (see [ADR 0002](docs/adr/0002-turborepo-monorepo.md)).
Standalone `pnpm test:e2e` uses `next dev` unless `CI=1` is set.
`pnpm check` applies Biome fixes;
`pnpm format` formats Markdown and YAML files.

`pnpm types:check` generates Next.js route types before running TypeScript, so
it works from a clean checkout.

GitHub Actions runs `.github/workflows/ci.yaml` on pull requests and pushes to
`main`. It installs dependencies with a frozen lockfile, runs `pnpm run ci`,
then installs Chromium and runs `pnpm run ci:e2e` as a separate compatibility
step. Testcontainers supplies disposable PostgreSQL databases for both operation
and browser tests.

To run the workflow locally, install `act`, start Docker, and run:

```bash
cp apps/web/.env.ci.example apps/web/.env.ci
act push -j ci
```

`.actrc` selects the `catthehacker/ubuntu:act-latest` runner image and
`linux/amd64` architecture and loads `apps/web/.env.ci` instead of the local
development `apps/web/.env`. Both are ignored by Git; only the templates are
committed. The workflow copies `apps/web/.env.ci.example` to `apps/web/.env`
inside the runner.
Testcontainers manages PostgreSQL, so local CI needs Docker access.
