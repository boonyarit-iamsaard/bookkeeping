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
      client.ts         # Server-only PostgreSQL pool and Drizzle client
      schema/           # Tables and relations, also used by Drizzle CLI
  features/
    auth/               # Sign-in/sign-up forms, hooks, and sign-out button
  shared/
    components/ui/      # Reusable UI primitives
    helpers/            # Helpers independent of business features
    hooks/              # Hooks shared across features
  styles/               # Global styles and fonts
```

Keep routes focused on composing features. Group business logic and its UI by
feature, such as `features/transactions/`, when that feature is implemented.
Keep feature-specific code in its feature folder; promote code to `shared/` only
when it is independent of a particular feature. Shared modules and core
infrastructure should not import feature code.

Server-side feature code can import `db` from `@/core/database/client`. Keep that
client out of Client Components and Drizzle CLI configuration. The CLI reads
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

| Command                  | Purpose                                                  |
| ------------------------ | -------------------------------------------------------- |
| `pnpm db:start`          | Start local PostgreSQL and wait for its health check     |
| `pnpm db:stop`           | Stop the local container while retaining its data volume |
| `pnpm db:push`           | Apply schema changes directly for local development      |
| `pnpm db:generate`       | Generate versioned migrations in `drizzle/`              |
| `pnpm db:migrate`        | Apply generated migrations                               |
| `pnpm db:migrate:deploy` | Apply generated migrations during deployment             |
| `pnpm db:studio`         | Open Drizzle Studio                                      |

Use versioned migrations for deployment. Commit generated migrations alongside
their schema changes.

PostgreSQL stores its initialized credentials in the persistent data volume.
Changing `POSTGRES_PASSWORD` in Compose does not change the password of an
already initialized database; update the existing database password and
`DATABASE_URL` together when changing credentials.

## Checks

```bash
pnpm lint
pnpm format:check
pnpm lint:md
pnpm types:check
pnpm build
```

`pnpm run ci` runs the complete check sequence. `pnpm check` applies Biome fixes;
`pnpm format` formats Markdown and YAML files.

`pnpm types:check` generates Next.js route types before running TypeScript, so
it works from a clean checkout.

GitHub Actions runs `.github/workflows/ci.yaml` on pull requests and pushes to
`main`, installing dependencies with a frozen lockfile before running
`pnpm run ci`.

To run the workflow locally, install `act`, start Docker, and run:

```bash
act push -j ci
```

`.actrc` selects the `catthehacker/ubuntu:act-latest` runner image and
`linux/amd64` architecture. Local CI does not require runtime environment values
or a running PostgreSQL instance.
