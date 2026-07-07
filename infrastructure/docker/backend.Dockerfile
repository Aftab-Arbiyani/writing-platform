# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Qalam backend (NestJS API + BullMQ workers)
#
# Strategy: SIMPLE and reliable over clever. We copy the whole monorepo
# (pruned by the root .dockerignore), install once, build with turbo, then use
# `pnpm deploy` to produce a pruned production-only copy of the backend
# workspace for a minimal runtime image.
#
# Build from the REPO ROOT (compose does this via `context: .`):
#   docker build -f infrastructure/docker/backend.Dockerfile .
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: base — Node 24 with pnpm activated via corepack ────────────────
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

# ── Stage 2: build — full monorepo install + turbo build ───────────────────
FROM base AS build

# Copy the entire monorepo. .dockerignore keeps node_modules, dist, .git,
# docs, and env files out of the context, so this stays small.
COPY . .

# Deterministic install against the committed lockfile.
RUN pnpm install --frozen-lockfile

# Build the backend and (via turbo's ^build dependency) every @qalam/* package
# it depends on, in the right order.
RUN pnpm turbo build --filter backend

# Produce a self-contained, production-only deployment of the backend
# workspace at /prod/backend: dist output + pruned prod node_modules with
# workspace deps materialized (no symlinks out of the tree).
RUN pnpm deploy --filter backend --prod /prod/backend

# ── Stage 3: runtime — minimal image, non-root ──────────────────────────────
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /prod/backend .

USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
