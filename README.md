# Bookkeeping

A bookkeeping application built with Next.js App Router, TypeScript, PostgreSQL,
and Drizzle ORM. Shared UI uses Tailwind CSS and shadcn components with Base UI.

## Local setup

Install Node.js, pnpm 10.27.0, and Docker with Docker Compose support. Start Docker
before starting the database.

```bash
pnpm install
cp .env.example .env
pnpm db:start
pnpm db:push
pnpm dev
```

For an existing checkout, keep your existing `.env`. Set `DATABASE_URL` to match
the PostgreSQL credentials in `docker-compose.yaml`.

Open [localhost:3000](http://localhost:3000). The home page is
`src/app/page.tsx`; global styles are in `src/styles/globals.css`. Fonts are Inter
and JetBrains Mono, configured in `src/styles/fonts.ts`.

## Project structure

```text
src/
  app/                  # Route entry points, layouts, and route handlers
  core/
    configs/env.ts      # Validated environment variables
    database/
      client.ts         # Server-only PostgreSQL pool and Drizzle client
      schema/           # Tables and relations, also used by Drizzle CLI
  features/             # Business behavior and feature-specific UI
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
the schema separately through `drizzle.config.ts`.

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
