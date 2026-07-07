# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Qalam frontend (React + Vite reader/writer app)
#
# Build stage compiles the static bundle with pnpm + turbo; runtime stage is
# plain nginx serving the bundle with SPA fallback (infrastructure/nginx/spa.conf).
#
# Build from the REPO ROOT (compose does this via `context: .`):
#   docker build -f infrastructure/docker/frontend.Dockerfile .
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build — full monorepo install + turbo build ───────────────────
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo

# Whole monorepo, pruned by the root .dockerignore.
COPY . .

RUN pnpm install --frozen-lockfile

# Builds frontend plus its @qalam/* workspace dependencies (turbo ^build).
RUN pnpm turbo build --filter frontend

# ── Stage 2: runtime — static bundle behind nginx ───────────────────────────
FROM nginx:alpine AS runtime

COPY --from=build /repo/frontend/dist /usr/share/nginx/html
COPY infrastructure/nginx/spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
