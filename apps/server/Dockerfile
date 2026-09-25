# syntax=docker/dockerfile:1
# Built from the repository root: docker build -f apps/server/Dockerfile .
FROM node:24-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Download packages in a layer keyed only by the lockfile and install inputs,
# so a source change reinstalls offline instead of refetching every package.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
RUN pnpm fetch --frozen-lockfile
# Only what the API build reads, so a web-only change keeps these layers
# cached. The web manifest keeps the lockfile's workspace importers complete.
COPY tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages packages
COPY apps/server apps/server
RUN pnpm install --frozen-lockfile --offline --filter @bookkeeping/server...
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
CMD ["node", "--enable-source-maps", "dist/server.js"]
