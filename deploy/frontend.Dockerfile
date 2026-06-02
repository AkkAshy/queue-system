# Generic Next.js (standalone) image for any @queue/<APP>. Build from repo root:
#   docker build -f deploy/frontend.Dockerfile --build-arg APP=kiosk \
#     --build-arg NEXT_PUBLIC_WS_URL=wss://queue.example.uz -t ndpi-kiosk .
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable

FROM base AS build
ARG APP
ARG NEXT_PUBLIC_USE_MSW=0
ARG NEXT_PUBLIC_WS_URL=
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
ENV NEXT_PUBLIC_USE_MSW=$NEXT_PUBLIC_USE_MSW \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN pnpm --filter @queue/${APP} build

FROM base AS runner
ARG APP
WORKDIR /repo
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    APP=${APP}
# standalone output is traced from the monorepo root, so it keeps the
# ./apps/<APP>/server.js + ./node_modules + ./packages layout.
COPY --from=build /repo/apps/${APP}/.next/standalone ./
COPY --from=build /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=build /repo/apps/${APP}/public ./apps/${APP}/public
EXPOSE 3000
# APP is fixed per built image; resolve the server path at start.
CMD ["sh", "-c", "node apps/${APP}/server.js"]
