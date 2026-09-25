# syntax=docker/dockerfile:1
# Built from the repository root:
# docker build -f apps/web/Dockerfile --build-arg VITE_API_ORIGIN=https://api.example.com .
FROM node:24-slim AS build
RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# .dockerignore omits .git. Give generate-api.ts --check a local baseline for
# the committed generated files so it can detect drift during the build.
RUN git init -q \
    && git add apps/web/src/core/api/openapi.json apps/web/src/core/api/openapi.gen.ts \
    && git -c user.name=Container -c user.email=container@example.invalid commit -qm "Baseline generated API client"
ARG VITE_API_ORIGIN
RUN test -n "$VITE_API_ORIGIN" || (echo "VITE_API_ORIGIN build argument is required" >&2 && exit 1)
RUN pnpm --filter @bookkeeping/web build

FROM caddy:2-alpine
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
