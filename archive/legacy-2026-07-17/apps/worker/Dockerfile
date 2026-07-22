FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS dev
COPY package.json pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install
COPY . .
CMD ["pnpm", "--filter=worker", "dev"]

FROM base AS builder
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter=worker build

FROM node:22-alpine AS production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
CMD ["node", "apps/worker/dist/index.js"]
