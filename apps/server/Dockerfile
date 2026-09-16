# syntax=docker/dockerfile:1

FROM node:24-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /workspace

RUN corepack enable

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile --filter @bookkeeping/server

COPY apps/server/ apps/server/

RUN pnpm --filter @bookkeeping/server build

FROM build AS production-dependencies

RUN pnpm --filter @bookkeeping/server deploy --prod --legacy /production/server

FROM node:24-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=production-dependencies /production/server/package.json ./package.json
COPY --from=production-dependencies /production/server/node_modules ./node_modules
COPY --from=build /workspace/apps/server/dist ./dist

USER node

EXPOSE 5000

CMD ["node", "dist/server.js"]
