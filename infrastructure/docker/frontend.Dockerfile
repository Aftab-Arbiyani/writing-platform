# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Qalam frontend (React + Vite reader/writer app)
#
# Build stage compiles the static bundle with pnpm + turbo; runtime stage is
# nginx serving the bundle with SPA fallback (infrastructure/nginx/spa.conf).
#
# The bundle is environment-specific: Vite inlines VITE_* values at build time,
# so the API URL / app env / Sentry DSN are passed as --build-arg and one image
# is built PER environment. nginx runs NON-ROOT on unprivileged port 8080.
#
# Build from the REPO ROOT (compose does this via `context: .`):
#   docker build -f infrastructure/docker/frontend.Dockerfile \
#     --build-arg VITE_API_URL=https://api.example.com .
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build — full monorepo install + turbo build ───────────────────
FROM node:26-alpine AS build
RUN corepack enable
WORKDIR /repo

# Per-environment Vite inputs. Vite only exposes VITE_-prefixed vars to the
# client bundle; they must be present in the environment BEFORE `vite build`.
ARG VITE_API_URL
ARG VITE_APP_ENV
ARG VITE_SENTRY_DSN
ENV VITE_API_URL=$VITE_API_URL \
    VITE_APP_ENV=$VITE_APP_ENV \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN

# Whole monorepo, pruned by the root .dockerignore.
COPY . .

RUN pnpm install --frozen-lockfile

# Builds frontend plus its @qalam/* workspace dependencies (turbo ^build).
RUN pnpm turbo build --filter frontend

# ── Stage 2: runtime — static bundle behind non-root nginx ──────────────────
FROM nginx:1.27-alpine AS runtime

# OCI image labels — trace the built bundle back to its source commit/build.
ARG BUILD_VERSION=0.0.0-dev
ARG GIT_SHA=unknown
ARG BUILD_TIME=
LABEL org.opencontainers.image.title="qalam-frontend" \
      org.opencontainers.image.description="Qalam reader/writer SPA (React + Vite) served by nginx" \
      org.opencontainers.image.source="https://github.com/qalam/qalam" \
      org.opencontainers.image.version="$BUILD_VERSION" \
      org.opencontainers.image.revision="$GIT_SHA" \
      org.opencontainers.image.created="$BUILD_TIME"

# Run entirely as the built-in unprivileged `nginx` user (uid 101). nginx:alpine
# starts as root by default, so rewire the pieces that need write access:
#   - pid file → /tmp (world-writable, sticky), master no longer needs /run
#   - drop the top-level `user` directive (meaningless without root; warns)
#   - hand the cache/log dirs to the nginx user
RUN set -eux; \
    sed -i 's!^pid .*;!pid /tmp/nginx.pid;!' /etc/nginx/nginx.conf; \
    sed -i '/^user  *nginx;/d' /etc/nginx/nginx.conf; \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

COPY --from=build /repo/frontend/dist /usr/share/nginx/html
COPY infrastructure/nginx/spa.conf /etc/nginx/conf.d/default.conf

USER nginx
EXPOSE 8080

# Serving healthcheck — nginx:alpine ships busybox wget (no curl).
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
