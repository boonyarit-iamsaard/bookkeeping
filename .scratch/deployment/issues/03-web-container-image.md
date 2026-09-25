# 03: Build the web container image

Read `../worker-brief.md` first.

**Blocked by:** 02 (reuses its root `.dockerignore`; both builds are heavy
and must not run together)

**Status:** done

**Why:** The SPA is static files. Caddy serves them on Railway with the
cache rules the installed PWA needs: hashed assets cached forever, and
everything else revalidated so a new release reaches the phone.

## Files you may create

- `apps/web/Dockerfile`
- `apps/web/Caddyfile`
- `apps/web/railway.json`

Nothing else. Do not edit `.dockerignore`, `apps/web/vite.config.ts`, the
web env parsing in `apps/web/src/core/env/config.ts`, or any `package.json`.

## Facts you can rely on

- `pnpm --filter @bookkeeping/web build` runs `generate-api.ts --check`
  (imports the server app in-process, so the build stage needs the whole
  workspace installed, but no database) and then `vite build` into
  `apps/web/dist`.
- `dist` contains `index.html`, `assets/` (hashed), `sw.js`,
  `workbox-<hash>.js`, `manifest.webmanifest`, `offline.html`, icons, and
  `favicon.ico`.
- `VITE_API_ORIGIN` is read by Vite at build time from the process
  environment; `.env` files are excluded from the Docker context by
  `.dockerignore`. The client validates it only at runtime in the browser, so
  the Dockerfile must refuse to build without it.
- Railway exposes service variables to a Docker build only through an `ARG`
  declared in the stage that uses it, and injects `PORT` at runtime.

## Reference contents

`apps/web/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
# Built from the repository root:
# docker build -f apps/web/Dockerfile --build-arg VITE_API_ORIGIN=https://api.example.com .
FROM node:24-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
ARG VITE_API_ORIGIN
RUN test -n "$VITE_API_ORIGIN" || (echo "VITE_API_ORIGIN build argument is required" >&2 && exit 1)
RUN pnpm --filter @bookkeeping/web build

FROM caddy:2-alpine
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
```

`apps/web/Caddyfile`:

```caddyfile
{
    admin off
    auto_https off
}

:{$PORT:8080} {
    root * /srv
    encode zstd gzip

    # Hashed build output never changes under the same name.
    handle /assets/* {
        header Cache-Control "public, max-age=31536000, immutable"
        file_server
    }

    # The shell, service worker, manifest, and icons revalidate so installed
    # PWAs pick up a release; unknown paths are client routes.
    handle {
        header Cache-Control "no-cache"
        try_files {path} /index.html
        file_server
    }
}
```

`apps/web/railway.json`:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "apps/web/Dockerfile",
    "watchPatterns": [
      "/apps/web/**",
      "/apps/server/**",
      "/packages/**",
      "/package.json",
      "/pnpm-lock.yaml",
      "/pnpm-workspace.yaml",
      "/.pnpmfile.cjs",
      "/tsconfig.base.json",
      "/.dockerignore"
    ]
  },
  "deploy": {
    "healthcheckPath": "/",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

`/apps/server/**` is watched because the web build checks the server's
OpenAPI document.

## Acceptance criteria

- [x] Building without `--build-arg VITE_API_ORIGIN` fails with the message above.
- [x] Building with it succeeds, and the built JavaScript contains that origin.
- [x] `GET /transactions` (a deep link) returns `200` with the app shell HTML.
- [x] `GET /assets/<missing>.js` returns `404`, not the shell.
- [x] A real file under `/assets/` carries `Cache-Control: public, max-age=31536000, immutable`.
- [x] `/`, `/sw.js`, and `/manifest.webmanifest` carry `Cache-Control: no-cache`.
- [x] `/manifest.webmanifest` is served with a manifest or JSON content type; if not, record it under Comments (fixing it is allowed only inside the `Caddyfile`).
- [x] Only the three allowed files were created.

**Verify** (run alone; Docker Desktop running):

```sh
docker build -f apps/web/Dockerfile -t bookkeeping-web-noarg .
docker build -f apps/web/Dockerfile --build-arg VITE_API_ORIGIN=https://api.example.test -t bookkeeping-web .
docker run --rm bookkeeping-web sh -c 'grep -rl "api.example.test" /srv/assets | head -1'
docker run -d --name bookkeeping-web-check -e PORT=8080 -p 8080:8080 bookkeeping-web
curl -sI http://localhost:8080/
curl -sI http://localhost:8080/transactions
curl -sI http://localhost:8080/sw.js
curl -sI http://localhost:8080/manifest.webmanifest
curl -sI http://localhost:8080/assets/does-not-exist.js
docker run --rm bookkeeping-web ls /srv/assets
curl -sI http://localhost:8080/assets/<a file listed above>
docker rm -f bookkeeping-web-check
```

The first build is expected to fail.

## Traps

- Do not replace Caddy with nginx, `serve`, or `vite preview`.
- Do not add a `/api` reverse proxy; the API stays on its own origin (ADR 0003).
- Do not bake a default `VITE_API_ORIGIN` into the Dockerfile.
- Do not touch the service worker's caching rules in `vite.config.ts`.

## Comments

Landed the three allowed files in `build: package the web client as a container image for railway`.
The Dockerfile installs Git and commits a build-local baseline of the two generated
API files. The reference build failed at `generate-api.ts --check` with
`spawnSync git ENOENT`; `.dockerignore` excludes the repository's `.git`, so
the local baseline lets that check detect generated API drift without changing
any other file. The Caddyfile and Railway config match the reference.

Verify output:

- The build without the argument failed as expected with `VITE_API_ORIGIN build argument is required`.
- The build with `VITE_API_ORIGIN=https://api.example.test` finished (`naming to docker.io/library/bookkeeping-web:latest done`); the generated API check reported `The committed API client matches the server's OpenAPI document.`
- `grep -rl "api.example.test" /srv/assets` found `/srv/assets/config-bNow76Nw.js`.
- `GET /` and `GET /transactions` returned `HTTP/1.1 200 OK`, and their response bodies matched.
- `GET /assets/does-not-exist.js` returned `HTTP/1.1 404 Not Found`.
- `GET /assets/CompositeItem-BlW9wPt-.js` returned `HTTP/1.1 200 OK` and `Cache-Control: public, max-age=31536000, immutable`.
- `GET /`, `/sw.js`, and `/manifest.webmanifest` returned `Cache-Control: no-cache`; the manifest's content type was `application/manifest+json`.
- `pnpm run ci` passed on the host: 13 test and typecheck tasks, then 2 build tasks. `pnpm-lock.yaml` retained hash `c043c671f5ee4fe4e682d32bbd97bcc9cfe7c6df`.
- Git status showed only the three implementation files plus this ticket update.
