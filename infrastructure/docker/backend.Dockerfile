# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Qalam backend (NestJS API + BullMQ workers)
#
# Strategy: SIMPLE and reliable over clever. We install once against the
# committed lockfile, build with turbo, then use `pnpm deploy` to produce a
# pruned production-only copy of the backend workspace for a minimal runtime
# image. To keep rebuilds fast, the dependency manifests are copied and
# installed BEFORE the sources, so editing a `.ts` file does not bust the
# (expensive) install layer.
#
# Build from the REPO ROOT (compose does this via `context: .`):
#   docker build -f infrastructure/docker/backend.Dockerfile .
#
# Build metadata (version/sha/time/…) is injected via --build-arg and baked in
# as both ENV (read by the app's /version + /health/config) and OCI labels, so
# a built image is self-describing and traceable back to a commit.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: base — Node 24 with the pinned pnpm activated via corepack ─────
# .nvmrc pins the major (24). We keep the floating -alpine tag here; CI should
# pin an immutable digest (e.g. node:24-alpine@sha256:…) for reproducible builds.
FROM node:25-alpine AS base
# Pin pnpm to the repo's packageManager version (reproducible builds, no drift).
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ── Stage 2: build — full monorepo install + turbo build ───────────────────
FROM base AS build

# Dependency manifests FIRST — this layer only rebuilds when a lockfile or a
# package.json changes, so ordinary source edits reuse the cached install.
# .npmrc carries engine-strict + auto-install-peers, so it must be present here.
COPY .npmrc pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY admin/package.json admin/package.json
COPY packages/api-types/package.json packages/api-types/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/utils/package.json packages/utils/package.json

# Deterministic install against the committed lockfile.
RUN pnpm install --frozen-lockfile

# Now the sources (pruned by the root .dockerignore: node_modules, dist, .git,
# docs, env files, and specs never enter the context).
COPY . .

# Build the backend and (via turbo's ^build dependency) every @qalam/* package
# it depends on, in the right order.
RUN pnpm turbo build --filter backend

# Produce a self-contained, production-only deployment of the backend
# workspace at /prod/backend: dist output + pruned prod node_modules with
# workspace deps materialized (no symlinks out of the tree).
RUN pnpm deploy --filter backend --prod /prod/backend

# ── Stage 3: runtime — minimal image, non-root ──────────────────────────────
FROM node:25-alpine AS runtime

# Build identity — single source of truth for the image's provenance. Injected
# at build time (--build-arg) and defaulted so a bare `docker build` still works.
ARG BUILD_VERSION=0.0.0-dev
ARG GIT_SHA=unknown
ARG BUILD_TIME=
ARG BUILD_NUMBER=0
ARG RELEASE_CHANNEL=production

ENV NODE_ENV=production \
    SERVICE_NAME=qalam-backend \
    APP_VERSION=$BUILD_VERSION \
    GIT_SHA=$GIT_SHA \
    BUILD_TIME=$BUILD_TIME \
    BUILD_NUMBER=$BUILD_NUMBER \
    RELEASE_CHANNEL=$RELEASE_CHANNEL

# OCI image labels — mirror the build identity so registries/scanners and
# `docker inspect` can trace an image back to its source commit and build.
LABEL org.opencontainers.image.title="qalam-backend" \
      org.opencontainers.image.description="Qalam backend API (NestJS + BullMQ workers)" \
      org.opencontainers.image.source="https://github.com/qalam/qalam" \
      org.opencontainers.image.version="$BUILD_VERSION" \
      org.opencontainers.image.revision="$GIT_SHA" \
      org.opencontainers.image.created="$BUILD_TIME"

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
