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

# ── Stage 1: base — Node 24 with the pinned pnpm activated via corepack ─────
FROM node:24-alpine AS base
# Pin pnpm to the repo's packageManager version (reproducible builds, no drift).
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
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

# Liveness healthcheck — hits /health (process-up only; no dependency checks, so
# a DB/Redis blip never marks the container unhealthy). Uses Node's global fetch
# (no curl/wget in the slim image). Orchestrators/compose gate on this.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
