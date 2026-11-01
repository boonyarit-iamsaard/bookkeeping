# Setup

## Local setup

Install Node.js 24, pnpm 11, and Docker with Docker Compose support. The exact
pnpm version and integrity hash are pinned in `packageManager`, and Corepack
(`corepack enable`) selects them. Start Docker before starting the database.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
cp apps/server/.env.example apps/server/.env
cp packages/database/.env.example packages/database/.env
```

Set `BETTER_AUTH_SECRET` in `apps/server/.env` to a random secret of at least
32 characters (generate one with `openssl rand -base64 32`). The example
`DATABASE_URL` values already match the local PostgreSQL in
`docker-compose.yaml`. Then start the database and both apps:

```bash
pnpm db:start
pnpm db:migrate
pnpm dev
```

`pnpm dev` runs the client and the API together through Turborepo and stops
them when you interrupt it; `pnpm dev:web` and `pnpm dev:server` run one alone.

Open [localhost:4000](http://localhost:4000). Without a session, every app page
redirects to `/sign-in`. Create an Account at `/sign-up`. The API answers at
[localhost:5000/health](http://localhost:5000/health); see
[Local origins](#local-origins) to change either address.

Global styles are in `apps/web/src/styles/globals.css`. Fonts are Inter and
JetBrains Mono, declared in `apps/web/src/styles/fonts.css`.

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
`pnpm start:server` runs the compiled production output with the environment
the caller injects, which `apps/server/turbo.json` passes through Turborepo.
The database commands load `DATABASE_URL` from `packages/database/.env` (copy
`packages/database/.env.example`), and `drizzle.config.ts` validates it. Each
workspace's scripts load only its own `.env`, through dotenvx; see
[Scripts and environment](../code-conventions.md#scripts-and-environment).

When `AUTH_SIGN_UP_ENABLED=false`, the API refuses new sign-ups, the web hides
the Sign-up link on the sign-in screen, and `/sign-up` redirects to `/sign-in`.
Existing Accounts can still sign in. Reopening Sign-up requires only changing
the API variable and redeploying the API; the web does not need to be rebuilt.

Docker Compose reads no environment files. `docker-compose.yaml` holds fixed,
local-only credentials and binds every port to loopback; the example
`DATABASE_URL` values match them.

`pnpm build` builds both apps and every package through Turborepo: the Vite
client build (which first checks the generated API client, and reruns when
`apps/web/.env` changes) and the server's
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

| Command           | Purpose                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `pnpm db:start`   | Start local PostgreSQL and wait for its health check                     |
| `pnpm db:stop`    | Stop PostgreSQL and the production containers, retaining the data volume |
| `pnpm db:push`    | Apply schema changes directly on a throwaway database                    |
| `pnpm db:migrate` | Apply pending committed migrations                                       |
| `pnpm db:fresh`   | Reset a local database and rebuild it from committed migrations          |
| `pnpm db:studio`  | Open Drizzle Studio                                                      |

These commands need only Docker and `packages/database/.env`; neither app has
to be running. The database commands run from `packages/database`, which owns
the schema. `db:fresh` is destructive and refuses any non-loopback host.

## Production containers

The API and web Railway images run locally through the opt-in `stack` profile
in `docker-compose.yaml`. The browser opens the web container at
`http://localhost:4000` and calls the API at `http://localhost:5000`.
`pnpm db:start` still starts only PostgreSQL.

| Command            | Purpose                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `pnpm stack:build` | Build the API image, then the web image                                                  |
| `pnpm stack:start` | Build both images and start them on ports 5000 and 4000, waiting for their health checks |
| `pnpm stack:stop`  | Stop and remove both app containers, leaving PostgreSQL running                          |
| `pnpm stack:logs`  | Follow both app containers' output                                                       |

Building an image is a heavy task, so `stack:build` builds one at a time. Stop
`pnpm dev:server` and `pnpm dev:web` first, since they use the same ports.

PostgreSQL stores its initialized credentials in the persistent data volume, so
editing `POSTGRES_PASSWORD` in `docker-compose.yaml` does not change an already
initialized database. The fixed credentials are safe because the port listens
only on loopback; keep it that way rather than changing the password.
