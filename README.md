# Bookkeeping

A bookkeeping application built with Next.js App Router, TypeScript, PostgreSQL,
and Drizzle ORM. Email and password authentication uses Better Auth. Shared UI
uses Tailwind CSS and shadcn components with Base UI.

## Local setup

Install Node.js 24, pnpm 10.27.0, and Docker with Docker Compose support. Start Docker
before starting the database.

```bash
pnpm install
cp .env.example .env
```

Set `BETTER_AUTH_SECRET` in `.env` to a random secret of at least 32 characters
(generate one with `openssl rand -base64 32`). Then start the database and app:

```bash
pnpm db:start
pnpm db:push
pnpm dev
```

For an existing checkout, keep your existing `.env`. Set `DATABASE_URL` to match
the PostgreSQL credentials in `docker-compose.yaml`.

Open [localhost:3000](http://localhost:3000). The home page is
`src/app/page.tsx` and redirects to `/dashboard`. Without a session, the dashboard
redirects to `/sign-in`. Create an account at `/sign-up`.

Global styles are in `src/styles/globals.css`. Fonts are Inter
and JetBrains Mono, configured in `src/styles/fonts.ts`.

## Project structure

```text
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
    wallets/            # Wallet operations, server actions, form, and list
  shared/
    components/ui/      # Reusable UI primitives
    helpers/            # Helpers independent of business features
    hooks/              # Hooks shared across features
  styles/               # Global styles and fonts
tests/
  database/             # PostgreSQL test harness (setup, rollback helper)
  e2e/                  # Playwright browser tests
```

Keep routes focused on composing features. Group business logic and its UI by
feature, such as `features/transactions/`, when that feature is implemented.
Keep feature-specific code in its feature folder; promote code to `shared/` only
when it is independent of a particular feature. Shared modules and core
infrastructure should not import feature code.

Server-side feature code can import `db` from `@/core/database/client`. Keep that
client out of Client Components and Drizzle CLI configuration. Feature
operations take a `Database` parameter rather than importing the client, so
tests can run them inside a rolled-back transaction. The CLI reads
the schema separately through `drizzle.config.ts`, which uses the shared env
configuration.

## Environment configuration

Set these values in `.env` for local development or inject them into the server
environment when deploying:

| Variable             | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `BETTER_AUTH_SECRET` | Auth secret of at least 32 characters         |
| `BETTER_AUTH_URL`    | App base URL, locally `http://localhost:3000` |
| `DATABASE_URL`       | PostgreSQL connection URL                     |

T3 Env validates these values when `src/core/env/config.ts` loads, including
during database and auth initialization. The Drizzle CLI also imports this
configuration and requires these values.

`pnpm build` sets `SKIP_ENV_VALIDATION=1` only for the build process, allowing the
app to build without runtime secrets or a running database. Do not set that flag
in the deployed server environment. `pnpm start` runs the production build with
runtime validation enabled.

## Database commands

| Command          | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `pnpm db:start`  | Start local PostgreSQL and wait for its health check     |
| `pnpm db:stop`   | Stop the local container while retaining its data volume |
| `pnpm db:push`   | Apply schema changes directly for local development      |
| `pnpm db:studio` | Open Drizzle Studio                                      |

The schema-change policy in [AGENTS.md](AGENTS.md#database-schema-changes)
requires `db:push` until the user explicitly authorizes switching to migrations.

PostgreSQL stores its initialized credentials in the persistent data volume.
Changing `POSTGRES_PASSWORD` in Compose does not change the password of an
already initialized database; update the existing database password and
`DATABASE_URL` together when changing credentials.

## Tests

```bash
pnpm test          # Vitest: pure helpers and PostgreSQL operation tests
pnpm test:e2e      # Playwright: browser flows against an isolated app/database
```

Tests load `.env` in every environment. GitHub Actions copies the checked-in
`.env.ci.example` to `.env` before running checks. Runtime environment validation
stays enabled. Testcontainers supplies the database URL, and the browser runner
overrides the app URL with its actual port.

Operation tests (`*.db.test.ts`) use Testcontainers to start a disposable
PostgreSQL 18 database on an available port. Docker must be running. The harness
applies the current schema with `db:push`, provides its connection URL to test
workers, and stops the container after the suite. Every test runs inside a
transaction that is rolled back. No local development database is used.

Browser tests live in `tests/e2e/` and need Chromium once:

```bash
pnpm exec playwright install --with-deps chromium
```

The browser runner creates its own disposable PostgreSQL database, pushes the
schema, and starts a fresh app server on an available port. It uses `pnpm dev`
locally and `pnpm start` in CI. It waits for server teardown before stopping
the database, including when interrupted. Server errors remain visible; enable
server stdout and startup diagnostics with `DEBUG=pw:webserver pnpm test:e2e`.

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

`pnpm run ci` runs the complete check sequence. `pnpm check` applies Biome fixes;
`pnpm format` formats Markdown and YAML files.

`pnpm types:check` generates Next.js route types before running TypeScript, so
it works from a clean checkout.

GitHub Actions runs `.github/workflows/ci.yaml` on pull requests and pushes to
`main`. It installs dependencies with a frozen lockfile and Chromium, then runs
`pnpm run ci`. Testcontainers supplies disposable PostgreSQL databases for both
operation and browser tests.

To run the workflow locally, install `act`, start Docker, and run:

```bash
cp .env.ci.example .env.ci
act push -j ci
```

`.actrc` selects the `catthehacker/ubuntu:act-latest` runner image and
`linux/amd64` architecture and loads `.env.ci` instead of the local development
`.env`. Both `.env` and `.env.ci` are ignored by Git; only the templates are
committed. The workflow copies `.env.ci.example` to `.env` inside the runner.
Testcontainers manages PostgreSQL, so local CI needs Docker access.
