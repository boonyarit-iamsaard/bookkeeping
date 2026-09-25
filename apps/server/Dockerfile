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
