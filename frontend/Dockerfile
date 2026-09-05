# =============================================================================
# Smart Construction Connect — FRONTEND container
#
#     docker build -t scc-web --build-arg VITE_API_URL=https://api.example.com ./frontend
#     docker run --rm -p 8080:8080 -e BACKEND_ORIGIN=https://api.example.com scc-web
#
# Two stages: Node builds the static bundle, nginx serves it. No Node runtime
# is needed in production — the output of `vite build` is plain static files.
#
# NOTE ON VITE_API_URL: Vite inlines VITE_* variables into the bundle at BUILD
# time, so this is a build argument, not a runtime environment variable.
# Changing it requires rebuilding the image. It only matters when the browser
# must reach the backend on a DIFFERENT origin than the page (it is used for
# the chat WebSocket). If you serve the API through this container's own
# /api proxy below, leave it empty.
# =============================================================================

FROM node:22-alpine AS build

WORKDIR /app

# Dependencies first — this layer is cached across code-only changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ── Serve stage ──────────────────────────────────────────────────────────────
# Unprivileged nginx: runs as UID 101 and listens on 8080, so the container
# needs no root and no NET_BIND_SERVICE capability under Kubernetes.
FROM nginxinc/nginx-unprivileged:1.27-alpine

# Origin the /api, /uploads and /company_data routes proxy to. Substituted into
# the config at container start by nginx's own envsubst entrypoint, so the same
# image works against any backend.
#
# Must have NO trailing slash: nginx treats "http://host/" in proxy_pass as a
# URI part and would strip the /api prefix before forwarding.
ENV BACKEND_ORIGIN="http://backend:8000"

COPY --chown=nginx:nginx nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
