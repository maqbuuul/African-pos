FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# ─── DEVELOPMENT ─────────────────────────────────────────────────────────────
FROM base AS dev
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install
COPY . .
EXPOSE 3000
CMD ["pnpm", "--filter=api", "dev"]

# ─── BUILD ───────────────────────────────────────────────────────────────────
FROM base AS builder
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter=api build

# ─── PRODUCTION ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
