# syntax=docker/dockerfile:1
# Build context is the repo root (a pnpm workspace) — see
# docker-compose.yml's `build.context` for this service, or run
# `docker build -f apps/owner-web/Dockerfile .` from the repo root.

FROM node:22-alpine AS base
WORKDIR /repo
RUN npm install -g pnpm@9.15.4 && pnpm config set store-dir /pnpm-store

FROM base AS deps
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter "@hospitality-os/owner-web..." run build

FROM base AS dev
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile
EXPOSE 5174
CMD ["pnpm", "--filter", "@hospitality-os/owner-web", "dev", "--host"]

FROM nginx:1.27-alpine AS prod
COPY infra/docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/owner-web/dist /usr/share/nginx/html
EXPOSE 80
