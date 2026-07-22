# syntax=docker/dockerfile:1
# Build context is the repo root (a pnpm workspace) — see
# docker-compose.yml's `build.context` for this service, or run
# `docker build -f apps/api/Dockerfile .` from the repo root directly.

FROM node:22-alpine AS base
WORKDIR /repo
RUN npm install -g pnpm@9.15.4 && pnpm config set store-dir /pnpm-store

FROM base AS deps
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter "@hospitality-os/api..." run build

FROM base AS dev
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile
EXPOSE 3000
CMD ["pnpm", "--filter", "@hospitality-os/api", "dev"]

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api ./apps/api
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
