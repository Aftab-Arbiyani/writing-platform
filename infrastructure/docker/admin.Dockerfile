# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Qalam admin panel (React + Vite)
#
# Identical pattern to frontend.Dockerfile: build the static bundle with
# pnpm + turbo, serve via nginx with SPA fallback.
#
# Build from the REPO ROOT (compose does this via `context: .`):
#   docker build -f infrastructure/docker/admin.Dockerfile .
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build — full monorepo install + turbo build ───────────────────
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo

# Whole monorepo, pruned by the root .dockerignore.
COPY . .

RUN pnpm install --frozen-lockfile

# Builds admin plus its @qalam/* workspace dependencies (turbo ^build).
RUN pnpm turbo build --filter admin

# ── Stage 2: runtime — static bundle behind nginx ───────────────────────────
FROM nginx:alpine AS runtime

COPY --from=build /repo/admin/dist /usr/share/nginx/html
COPY infrastructure/nginx/spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
