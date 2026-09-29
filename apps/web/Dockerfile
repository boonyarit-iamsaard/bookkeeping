# syntax=docker/dockerfile:1
# Built from the repository root:
# docker build -f apps/web/Dockerfile --build-arg VITE_API_ORIGIN=https://api.example.com .
FROM node:24-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS build
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

FROM caddy:2-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
