# 02: Build the API container image

Read `../worker-brief.md` first.

**Blocked by:** none

**Status:** ready-for-agent

**Why:** Railway builds each service from a Dockerfile at the repository
root (the monorepo is shared, not isolated). The API image must run the
existing esbuild output on Node.js with only production dependencies, so
production is the same code the tests exercise.

## Files you may create

- `apps/server/Dockerfile`
- `apps/server/railway.json`
- `.dockerignore` (repository root; ticket 03 reuses it and must not edit it)

Nothing else. Do not edit `apps/server/scripts/build.ts`, any
`package.json`, `pnpm-workspace.yaml`, the lockfile, or Compose files.

## Facts you can rely on

- `pnpm --filter @bookkeeping/server build` writes `apps/server/dist/server.js`
  (plus a source map). Workspace packages are bundled in; every other import
  stays external and must resolve from `node_modules` at runtime
  (`apps/server/scripts/build.ts`).
- The server reads `PORT` (default 5000) and `HOST` (default `0.0.0.0`) and
  requires `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥32 chars),
  `BETTER_AUTH_URL`, `CLIENT_ORIGINS`. Health is `GET /health`.
- `packageManager` is `pnpm@10.27.0`; `corepack enable` provides it. CI uses
  Node 24.
- pnpm 10's `pnpm deploy` requires `--legacy` in a workspace without
  `inject-workspace-packages`. `apps/server/dist` is gitignored, so do not
  rely on `pnpm deploy` to copy it; copy it explicitly.
- Railway: config file fields and schema from
  <https://docs.railway.com/reference/config-as-code>; watch patterns are
  gitignore-style and relative to the repository root.

## Reference contents

`.dockerignore`:

```text
**/node_modules
**/dist
**/.turbo
**/.env
**/.env.*
!**/.env.example
.git
.scratch
coverage
.scannerwork
.sonar-reports
**/test-results
**/playwright-report
```

`apps/server/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
# Built from the repository root: docker build -f apps/server/Dockerfile .
FROM node:24-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @bookkeeping/server build
RUN pnpm --filter @bookkeeping/server deploy --prod --legacy /out

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/server/dist ./dist
USER node
EXPOSE 5000
CMD ["node", "dist/server.js"]
```

`apps/server/railway.json`:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "apps/server/Dockerfile",
    "watchPatterns": [
      "/apps/server/**",
      "/packages/**",
      "/package.json",
      "/pnpm-lock.yaml",
      "/pnpm-workspace.yaml",
      "/.dockerignore"
    ]
  },
  "deploy": {
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

## Acceptance criteria

- [ ] `docker build -f apps/server/Dockerfile -t bookkeeping-api .` succeeds from the repository root and `pnpm-lock.yaml` is unchanged afterwards.
- [ ] The running container answers `GET /health` with `200`.
- [ ] Against the local database, `POST /api/auth/sign-up/email` with `Origin: http://localhost:4000` returns `200` and a `Set-Cookie` header.
- [ ] `docker run --rm bookkeeping-api ls node_modules` lists no `vitest`, `esbuild`, `tsx`, or `typescript`.
- [ ] `docker run --rm bookkeeping-api sh -c 'ls -a /app'` shows no `.env` file.
- [ ] Only the three allowed files were created.

**Verify** (run alone; Docker Desktop running):

```sh
pnpm db:start
pnpm db:push
docker build -f apps/server/Dockerfile -t bookkeeping-api .
docker run -d --name bookkeeping-api-check --network bookkeeping-network -p 5000:5000 \
  -e DATABASE_URL=postgresql://postgres:password@bookkeeping-postgres:5432/bookkeeping \
  -e BETTER_AUTH_SECRET=local-check-secret-with-at-least-32-characters \
  -e BETTER_AUTH_URL=http://localhost:5000 \
  -e CLIENT_ORIGINS=http://localhost:4000 \
  bookkeeping-api
curl -i http://localhost:5000/health
curl -i -X POST http://localhost:5000/api/auth/sign-up/email \
  -H "content-type: application/json" -H "origin: http://localhost:4000" \
  -d '{"name":"Image check","email":"image-check@test.local","password":"correct horse battery"}'
docker rm -f bookkeeping-api-check
```

Stop your local dev server first if it holds port 5000. If the sign-up email
already exists from an earlier run, use a new address.

## Traps

- Do not switch to Alpine: `node:24-slim` avoids musl surprises and matches
  CI's glibc.
- Do not run `tsx` or the TypeScript sources in production; run `dist/`.
- Do not add a `HEALTHCHECK` instruction; Railway's `healthcheckPath` owns it.
- Do not add `db:push`, migrations, or a pre-deploy command.
- If `pnpm deploy --legacy` is rejected, that is a stop condition, not a
  reason to hand-copy `node_modules` from the build stage.
