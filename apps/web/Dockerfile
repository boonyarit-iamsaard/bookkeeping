# syntax=docker/dockerfile:1
# Built from the repository root:
# docker build -f apps/web/Dockerfile --build-arg VITE_API_ORIGIN=https://api.example.com .
FROM node:24-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build
RUN corepack enable
WORKDIR /repo
# Download packages in a layer keyed only by the lockfile and install inputs,
# so a source change reinstalls offline instead of refetching every package.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs .npmrc ./
RUN pnpm fetch --frozen-lockfile
COPY . .
# The build checks the generated API client against the server source, so the
# filter's dependency closure includes the server.
RUN pnpm install --frozen-lockfile --offline --filter @bookkeeping/web...
ARG VITE_API_ORIGIN
RUN test -n "$VITE_API_ORIGIN" || (echo "VITE_API_ORIGIN build argument is required" >&2 && exit 1)
RUN pnpm --filter @bookkeeping/web build

FROM caddy:2-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0
RUN addgroup -S web && adduser -S -G web web \
    && chown -R web:web /config /data
USER web
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
